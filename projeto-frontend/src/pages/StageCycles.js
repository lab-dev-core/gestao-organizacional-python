import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  Plus, Search, Pencil, Trash2, Calendar, Users, CalendarDays,
  Play, CheckCircle, Clock
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const StageCyclesPage = () => {
  const { getAuthHeaders, isAdmin } = useAuth();
  const { t } = useLanguage();

  const [cycles, setCycles] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCycle, setEditingCycle] = useState(null);
  const [formData, setFormData] = useState({
    formative_stage_id: '',
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'planned',
    max_participants: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [cyclesRes, stagesRes] = await Promise.all([
        axios.get(`${API_URL}/stage-cycles`, { headers }),
        axios.get(`${API_URL}/formative-stages`, { headers })
      ]);

      setCycles(cyclesRes.data);
      setStages(stagesRes.data.sort((a, b) => (a.order || 0) - (b.order || 0)));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('errorOccurred'));
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      formative_stage_id: '',
      name: '',
      description: '',
      start_date: '',
      end_date: '',
      status: 'planned',
      max_participants: ''
    });
    setEditingCycle(null);
  };

  const handleOpenDialog = (cycle = null) => {
    if (cycle) {
      setEditingCycle(cycle);
      setFormData({
        formative_stage_id: cycle.formative_stage_id,
        name: cycle.name,
        description: cycle.description || '',
        start_date: cycle.start_date?.split('T')[0] || '',
        end_date: cycle.end_date?.split('T')[0] || '',
        status: cycle.status,
        max_participants: cycle.max_participants || ''
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const headers = getAuthHeaders();
      const payload = {
        ...formData,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null
      };

      if (editingCycle) {
        await axios.put(`${API_URL}/stage-cycles/${editingCycle.id}`, payload, { headers });
        toast.success(t('cycleUpdated'));
      } else {
        await axios.post(`${API_URL}/stage-cycles`, payload, { headers });
        toast.success(t('cycleCreated'));
      }

      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving cycle:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const handleDelete = async (cycleId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/stage-cycles/${cycleId}`, { headers });
      toast.success(t('cycleDeleted'));
      fetchData();
    } catch (error) {
      console.error('Error deleting cycle:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      planned: { variant: 'secondary', icon: Clock, label: t('planned') },
      in_progress: { variant: 'default', icon: Play, label: t('inProgress') },
      finished: { variant: 'outline', icon: CheckCircle, label: t('finished') }
    };
    const { variant, icon: Icon, label } = config[status] || config.planned;
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const filteredCycles = cycles.filter(cycle => {
    const matchesSearch = cycle.name?.toLowerCase().includes(search.toLowerCase()) ||
      cycle.stage_name?.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === 'all' || cycle.formative_stage_id === stageFilter;
    const matchesStatus = statusFilter === 'all' || cycle.status === statusFilter;
    return matchesSearch && matchesStage && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="stage-cycles-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('stageCycles')}</h1>
          <p className="text-muted-foreground mt-1">{t('stageCyclesDescription')}</p>
        </div>

        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="new-cycle-btn">
                <Plus className="w-4 h-4 mr-2" />
                {t('newCycle')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingCycle ? t('editCycle') : t('newCycle')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('formativeStage')} *</Label>
                  <Select
                    value={formData.formative_stage_id}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, formative_stage_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectStage')} />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.order}. {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t('cycleName')} *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('cycleNamePlaceholder')}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('description')}</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('startDate')} *</Label>
                    <Input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('endDate')} *</Label>
                    <Input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('status')}</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">{t('planned')}</SelectItem>
                        <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                        <SelectItem value="finished">{t('finished')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('maxParticipants')}</Label>
                    <Input
                      type="number"
                      value={formData.max_participants}
                      onChange={(e) => setFormData(prev => ({ ...prev, max_participants: e.target.value }))}
                      placeholder={t('unlimited')}
                      min="1"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">{t('cancel')}</Button>
                  </DialogClose>
                  <Button type="submit">{t('save')}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/10">
                <CalendarDays className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('totalCycles')}</p>
                <p className="text-2xl font-bold">{cycles.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Play className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('activeCycles')}</p>
                <p className="text-2xl font-bold">
                  {cycles.filter(c => c.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('totalParticipants')}</p>
                <p className="text-2xl font-bold">
                  {cycles.reduce((acc, c) => acc + (c.participants_count || 0), 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={`${t('search')}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder={t('formativeStage')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allStages')}</SelectItem>
                {stages.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder={t('status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                <SelectItem value="planned">{t('planned')}</SelectItem>
                <SelectItem value="in_progress">{t('inProgress')}</SelectItem>
                <SelectItem value="finished">{t('finished')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cycles Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('cycle')}</TableHead>
                  <TableHead>{t('formativeStage')}</TableHead>
                  <TableHead>{t('period')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('participants')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCycles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <CalendarDays className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{t('noCyclesFound')}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCycles.map(cycle => (
                    <TableRow key={cycle.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{cycle.name}</span>
                          {cycle.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {cycle.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{cycle.stage_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="w-3 h-3" />
                          {formatDate(cycle.start_date)} - {formatDate(cycle.end_date)}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(cycle.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span>{cycle.participants_count || 0}</span>
                          {cycle.max_participants && (
                            <span className="text-muted-foreground">/ {cycle.max_participants}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(cycle)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('confirmDelete')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('confirmDeleteCycleMessage')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(cycle.id)}>
                                    {t('delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default StageCyclesPage;
