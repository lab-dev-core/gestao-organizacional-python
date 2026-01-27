import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Plus, Search, Pencil, Trash2, ClipboardList, ChevronLeft, GraduationCap, Lock, Calendar, Clock, MapPin, User, MessageSquare, FileDown, Download } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AcompanhamentosPage = () => {
  const { getAuthHeaders, isAdmin, isFormador, user } = useAuth();
  const { t } = useLanguage();
  
  const [acompanhamentos, setAcompanhamentos] = useState([]);
  const [stages, setStages] = useState([]);
  const [stageCounts, setStageCounts] = useState({});
  const [formandos, setFormandos] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAcomp, setEditingAcomp] = useState(null);
  const [viewingAcomp, setViewingAcomp] = useState(null);
  
  const [formData, setFormData] = useState({
    user_id: '',
    date: '',
    time: '',
    location: '',
    content: '',
    frequency: 'biweekly',
    formative_stage_id: ''
  });

  const canManage = isAdmin || isFormador;

  // Check if user has access to a stage
  const hasAccessToStage = (stageId) => {
    if (isAdmin || isFormador) return true;
    return user?.formative_stage_id === stageId;
  };

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [acompRes, stagesRes, countsRes] = await Promise.all([
        axios.get(`${API_URL}/acompanhamentos`, { headers }),
        axios.get(`${API_URL}/formative-stages`, { headers }),
        axios.get(`${API_URL}/acompanhamentos/count-by-stage`, { headers })
      ]);
      
      setAcompanhamentos(acompRes.data);
      setStages(stagesRes.data.sort((a, b) => a.order - b.order));
      setStageCounts(countsRes.data);
      
      // If formador, fetch their formandos
      if (isFormador || isAdmin) {
        try {
          const formandosRes = await axios.get(`${API_URL}/acompanhamentos/my-formandos`, { headers });
          setFormandos(formandosRes.data);
        } catch (e) {
          setFormandos([]);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, isFormador, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      user_id: '',
      date: new Date().toISOString().split('T')[0],
      time: '',
      location: '',
      content: '',
      frequency: 'biweekly',
      formative_stage_id: selectedStage?.id || ''
    });
    setEditingAcomp(null);
  };

  const handleOpenDialog = (acomp = null) => {
    if (acomp) {
      setEditingAcomp(acomp);
      setFormData({
        user_id: acomp.user_id,
        date: acomp.date,
        time: acomp.time,
        location: acomp.location,
        content: acomp.content,
        frequency: acomp.frequency,
        formative_stage_id: acomp.formative_stage_id || ''
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.user_id) {
      toast.error('Selecione um formando');
      return;
    }

    try {
      const headers = getAuthHeaders();
      const payload = {
        ...formData,
        formative_stage_id: formData.formative_stage_id || selectedStage?.id
      };

      if (editingAcomp) {
        await axios.put(`${API_URL}/acompanhamentos/${editingAcomp.id}`, payload, { headers });
        toast.success('Acompanhamento atualizado com sucesso');
      } else {
        await axios.post(`${API_URL}/acompanhamentos`, payload, { headers });
        toast.success('Acompanhamento criado com sucesso');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving acompanhamento:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const handleDelete = async (acompId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/acompanhamentos/${acompId}`, { headers });
      toast.success('Acompanhamento excluído com sucesso');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  // Export single acompanhamento as PDF
  const handleExportPdf = async (acompId) => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API_URL}/acompanhamentos/${acompId}/pdf`, {
        headers,
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `acompanhamento_${acompId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Erro ao exportar PDF');
    }
  };

  // Export all acompanhamentos from current stage as PDF
  const handleExportAllPdf = async () => {
    try {
      const headers = getAuthHeaders();
      const params = new URLSearchParams();
      if (selectedStage) {
        params.append('formative_stage_id', selectedStage.id);
      }
      
      const response = await axios.get(`${API_URL}/acompanhamentos/export/pdf?${params.toString()}`, {
        headers,
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const stageName = selectedStage ? selectedStage.name.replace(/\s+/g, '_') : 'todos';
      link.setAttribute('download', `acompanhamentos_${stageName}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      if (error.response?.status === 404) {
        toast.error('Nenhum acompanhamento encontrado para exportar');
      } else {
        toast.error('Erro ao exportar PDF');
      }
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getFrequencyLabel = (freq) => {
    return freq === 'weekly' ? 'Semanal' : 'Quinzenal';
  };

  // Get acompanhamentos for selected stage
  const getStageAcompanhamentos = () => {
    if (!selectedStage) return [];
    return acompanhamentos.filter(acomp => 
      acomp.formative_stage_id === selectedStage.id
    );
  };

  // Get general acompanhamentos (without stage)
  const getGeneralAcompanhamentos = () => {
    return acompanhamentos.filter(acomp => !acomp.formative_stage_id);
  };

  const filteredAcompanhamentos = (selectedStage ? getStageAcompanhamentos() : acompanhamentos).filter(acomp => {
    return acomp.user_name?.toLowerCase().includes(search.toLowerCase()) ||
           acomp.content?.toLowerCase().includes(search.toLowerCase()) ||
           acomp.location?.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Stage Selection View
  if (!selectedStage) {
    return (
      <div className="space-y-6" data-testid="acompanhamentos-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Acompanhamentos</h1>
          <p className="text-muted-foreground mt-1">
            {canManage 
              ? 'Selecione uma etapa formativa para gerenciar acompanhamentos'
              : 'Selecione uma etapa para ver seus acompanhamentos'
            }
          </p>
        </div>

        {/* Stages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stages.map((stage) => {
            const hasAccess = hasAccessToStage(stage.id);
            const acompCount = stageCounts[stage.id] || 0;
            
            return (
              <Card 
                key={stage.id}
                className={`border-0 shadow-md overflow-hidden transition-all duration-200 ${
                  hasAccess 
                    ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1' 
                    : 'opacity-60 cursor-not-allowed'
                }`}
                onClick={() => hasAccess && setSelectedStage(stage)}
                data-testid={`stage-folder-${stage.id}`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`p-4 rounded-xl ${
                      hasAccess ? 'bg-emerald-500/10' : 'bg-muted'
                    }`}>
                      {hasAccess ? (
                        <ClipboardList className={`w-8 h-8 ${hasAccess ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                      ) : (
                        <Lock className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {stage.order}
                    </Badge>
                  </div>
                  
                  <div className="mt-4">
                    <h3 className="font-semibold text-lg">{stage.name}</h3>
                    {stage.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {stage.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageSquare className="w-4 h-4" />
                      <span>{acompCount} {acompCount === 1 ? 'acompanhamento' : 'acompanhamentos'}</span>
                    </div>
                    {stage.estimated_duration && (
                      <Badge variant="outline" className="text-xs">
                        {stage.estimated_duration}
                      </Badge>
                    )}
                  </div>
                  
                  {!hasAccess && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Acesso restrito à sua etapa formativa
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
          
          {stages.length === 0 && (
            <Card className="col-span-full border-0 shadow-md">
              <CardContent className="py-16 text-center text-muted-foreground">
                <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Nenhuma etapa formativa cadastrada</p>
                <p className="text-sm mt-2">Cadastre etapas formativas para organizar os acompanhamentos</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Acompanhamentos */}
        {acompanhamentos.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Acompanhamentos Recentes</h2>
            <div className="grid gap-4">
              {acompanhamentos.slice(0, 5).map(acomp => (
                <Card key={acomp.id} className="border-0 shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12 border-2 border-primary/20">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(acomp.user_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold">{acomp.user_name}</h3>
                          <Badge variant="outline">{getFrequencyLabel(acomp.frequency)}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(acomp.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {acomp.time}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {acomp.location}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {acomp.content}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Acompanhamentos List View (inside a stage)
  return (
    <div className="space-y-6" data-testid="acompanhamentos-stage-view">
      {/* View Acompanhamento Dialog */}
      <Dialog open={!!viewingAcomp} onOpenChange={() => setViewingAcomp(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Acompanhamento</DialogTitle>
          </DialogHeader>
          {viewingAcomp && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <Avatar className="h-16 w-16 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary text-xl">
                    {getInitials(viewingAcomp.user_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold">{viewingAcomp.user_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Formador: {viewingAcomp.formador_name}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Calendar className="w-4 h-4" />
                    Data
                  </div>
                  <p className="font-medium">{formatDate(viewingAcomp.date)}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    Horário
                  </div>
                  <p className="font-medium">{viewingAcomp.time}</p>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <MapPin className="w-4 h-4" />
                    Local
                  </div>
                  <p className="font-medium">{viewingAcomp.location}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm text-muted-foreground">Frequência</Label>
                <Badge className="mt-1">{getFrequencyLabel(viewingAcomp.frequency)}</Badge>
              </div>
              
              <div>
                <Label className="text-sm text-muted-foreground">Relatório do Acompanhamento</Label>
                <div className="mt-2 p-4 bg-muted/30 rounded-lg whitespace-pre-wrap">
                  {viewingAcomp.content}
                </div>
              </div>
              
              {/* Export PDF Button */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => handleExportPdf(viewingAcomp.id)}
                  className="w-full"
                  data-testid="export-single-pdf-btn"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar como PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Header with Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedStage(null)}
            data-testid="back-to-stages-btn"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{selectedStage.order}</Badge>
              <h1 className="text-2xl font-bold tracking-tight">{selectedStage.name}</h1>
            </div>
            <p className="text-muted-foreground mt-1">
              {filteredAcompanhamentos.length} acompanhamentos
              {selectedStage.estimated_duration && ` • ${selectedStage.estimated_duration}`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Export All PDF Button */}
          {filteredAcompanhamentos.length > 0 && (
            <Button
              variant="outline"
              onClick={handleExportAllPdf}
              data-testid="export-all-pdf-btn"
            >
              <FileDown className="w-4 h-4 mr-2" />
              Exportar Todos
            </Button>
          )}
          
          {canManage && formandos.length > 0 && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()} data-testid="new-acompanhamento-btn">
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Acompanhamento
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingAcomp ? 'Editar Acompanhamento' : 'Novo Acompanhamento'}</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] pr-4">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Formando *</Label>
                      <Select
                        value={formData.user_id}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, user_id: v }))}
                        disabled={!!editingAcomp}
                      >
                        <SelectTrigger data-testid="acomp-user-select">
                          <SelectValue placeholder="Selecione um formando..." />
                      </SelectTrigger>
                      <SelectContent>
                        {formandos.map(formando => (
                          <SelectItem key={formando.id} value={formando.id}>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              {formando.full_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formandos.length === 0 && (
                      <p className="text-xs text-amber-600">
                        Nenhum formando atribuído a você. Peça ao administrador para vincular formandos.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data *</Label>
                      <Input
                        type="date"
                        value={formData.date}
                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                        required
                        data-testid="acomp-date-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário *</Label>
                      <Input
                        type="time"
                        value={formData.time}
                        onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                        required
                        data-testid="acomp-time-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Local *</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Ex: Sala de reuniões, Online, etc."
                      required
                      data-testid="acomp-location-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Frequência</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, frequency: v }))}
                    >
                      <SelectTrigger data-testid="acomp-frequency-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="biweekly">Quinzenal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Relatório do Acompanhamento *</Label>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Descreva os pontos discutidos, progresso do formando, observações importantes..."
                      rows={6}
                      required
                      data-testid="acomp-content-input"
                    />
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Etapa: {selectedStage.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Este acompanhamento será vinculado a esta etapa formativa
                    </p>
                  </div>

                  <DialogFooter className="pt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">{t('cancel')}</Button>
                    </DialogClose>
                    <Button type="submit" data-testid="acomp-submit-btn">{t('save')}</Button>
                  </DialogFooter>
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por formando, conteúdo ou local..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="acompanhamentos-search-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Acompanhamentos List */}
      {filteredAcompanhamentos.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center text-muted-foreground">
            <ClipboardList className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Nenhum acompanhamento nesta etapa</p>
            {canManage && formandos.length > 0 && (
              <Button
                variant="link"
                onClick={() => handleOpenDialog()}
                className="mt-2"
              >
                Adicionar primeiro acompanhamento
              </Button>
            )}
            {canManage && formandos.length === 0 && (
              <p className="text-sm mt-2">
                Você não possui formandos atribuídos. Peça ao administrador para vincular formandos.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAcompanhamentos.map(acomp => (
            <Card 
              key={acomp.id} 
              className="border-0 shadow-md card-hover cursor-pointer"
              onClick={() => setViewingAcomp(acomp)}
              data-testid={`acomp-card-${acomp.id}`}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="h-14 w-14 border-2 border-primary/20">
                    <AvatarFallback className="bg-emerald-500/10 text-emerald-600 text-lg">
                      {getInitials(acomp.user_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-lg">{acomp.user_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          por {acomp.formador_name}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {getFrequencyLabel(acomp.frequency)}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {formatDate(acomp.date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        {acomp.time}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        {acomp.location}
                      </span>
                    </div>
                    
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                      {acomp.content}
                    </p>
                    
                    {/* Actions */}
                    {canManage && (
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(acomp)}
                          data-testid={`edit-acomp-${acomp.id}`}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-destructive"
                              data-testid={`delete-acomp-${acomp.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Excluir
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('confirmDeleteMessage')} {t('actionCannotBeUndone')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(acomp.id)}>
                                {t('delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AcompanhamentosPage;
