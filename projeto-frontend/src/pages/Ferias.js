import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ScrollArea } from '../components/ui/scroll-area';
import { Progress } from '../components/ui/progress';
import { Textarea } from '../components/ui/textarea';
import { Plus, Pencil, Trash2, Loader2, Palmtree, Settings, CalendarDays, User, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const STATUS_LABELS = {
  pendente: 'Pendente',
  aprovado: 'Aprovado',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

const STATUS_COLORS = {
  pendente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  aprovado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  em_andamento: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  concluido: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  cancelado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const FeriasPage = () => {
  const { getAuthHeaders, isAdmin, isFormador, user } = useAuth();
  const canManage = isAdmin || isFormador;

  const [ferias, setFerias] = useState([]);
  const [users, setUsers] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [config, setConfig] = useState({ max_vacation_days: 30 });
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingFerias, setEditingFerias] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState('all');

  const [formData, setFormData] = useState({
    user_id: '',
    predicted_start_date: '',
    predicted_end_date: '',
    actual_start_date: '',
    actual_end_date: '',
    status: 'pendente',
    notes: '',
  });

  const [configForm, setConfigForm] = useState({ max_vacation_days: 30 });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const params = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (selectedUserId !== 'all') params.user_id = selectedUserId;

      const [feriasRes, resumoRes, configRes] = await Promise.allSettled([
        axios.get(`${API_URL}/ferias`, { headers, params: { ...params, limit: 100 } }),
        axios.get(`${API_URL}/ferias/resumo`, { headers }),
        axios.get(`${API_URL}/ferias/config`, { headers }),
      ]);

      if (feriasRes.status === 'fulfilled') setFerias(feriasRes.value.data);
      if (resumoRes.status === 'fulfilled') setResumo(resumoRes.value.data);
      if (configRes.status === 'fulfilled') {
        setConfig(configRes.value.data);
        setConfigForm(configRes.value.data);
      }

      if (canManage) {
        const usersRes = await axios.get(`${API_URL}/users`, { headers, params: { limit: 200 } });
        setUsers(usersRes.data.filter(u => {
          const roles = u.roles || (u.role ? [u.role] : []);
          return !roles.includes('superadmin');
        }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, canManage, statusFilter, selectedUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      user_id: user?.id || '',
      predicted_start_date: '',
      predicted_end_date: '',
      actual_start_date: '',
      actual_end_date: '',
      status: 'pendente',
      notes: '',
    });
    setEditingFerias(null);
  };

  const handleOpenDialog = (item = null) => {
    if (item) {
      setEditingFerias(item);
      setFormData({
        user_id: item.user_id,
        predicted_start_date: item.predicted_start_date || '',
        predicted_end_date: item.predicted_end_date || '',
        actual_start_date: item.actual_start_date || '',
        actual_end_date: item.actual_end_date || '',
        status: item.status || 'pendente',
        notes: item.notes || '',
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.predicted_start_date || !formData.predicted_end_date) {
      toast.error('Preencha as datas previstas');
      return;
    }
    setSaving(true);
    try {
      const headers = getAuthHeaders();
      const payload = { ...formData };
      if (!payload.actual_start_date) delete payload.actual_start_date;
      if (!payload.actual_end_date) delete payload.actual_end_date;
      if (!payload.notes) delete payload.notes;

      if (editingFerias) {
        await axios.put(`${API_URL}/ferias/${editingFerias.id}`, payload, { headers });
        toast.success('Férias atualizadas');
      } else {
        await axios.post(`${API_URL}/ferias`, payload, { headers });
        toast.success('Férias registradas');
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/ferias/${id}`, { headers });
      toast.success('Férias removidas');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao remover');
    }
  };

  const handleQuickStatus = async (id, status) => {
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API_URL}/ferias/${id}`, { status }, { headers });
      toast.success(`Status atualizado para ${STATUS_LABELS[status]}`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao atualizar status');
    }
  };

  const handleSaveConfig = async () => {
    try {
      const headers = getAuthHeaders();
      await axios.put(`${API_URL}/ferias/config`, configForm, { headers });
      toast.success('Configuração salva');
      setConfigDialogOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar configuração');
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const parts = d.split('-');
    if (parts.length < 3) return d;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const calcDays = (start, end) => {
    if (!start || !end) return null;
    try {
      const d1 = new Date(start);
      const d2 = new Date(end);
      return Math.max(0, Math.round((d2 - d1) / 86400000) + 1);
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const usedPct = resumo ? Math.min(100, Math.round((resumo.used_days / resumo.max_vacation_days) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Palmtree className="w-8 h-8 text-primary" />
            Férias
          </h1>
          <p className="text-muted-foreground mt-1">Controle e registro de férias</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setConfigDialogOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Configurar
            </Button>
          )}
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Registrar Férias
          </Button>
        </div>
      </div>

      {/* Resumo do usuário atual */}
      {resumo && (
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              Meu Saldo de Férias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>{resumo.used_days} dias usados</span>
              <span className="font-semibold">{resumo.remaining_days} dias restantes</span>
              <span className="text-muted-foreground">de {resumo.max_vacation_days} dias</span>
            </div>
            <Progress value={usedPct} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManage && (
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full sm:w-52">
                  <SelectValue placeholder="Usuário" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  {users.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  {canManage && <TableHead>Usuário</TableHead>}
                  <TableHead>Previsão</TableHead>
                  <TableHead>Datas Efetivas</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ferias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManage ? 7 : 6} className="text-center py-12 text-muted-foreground">
                      <Palmtree className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      Nenhum registro de férias encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  ferias.map(f => (
                    <TableRow key={f.id}>
                      {canManage && (
                        <TableCell className="font-medium">{f.user_name}</TableCell>
                      )}
                      <TableCell className="text-sm">
                        {formatDate(f.predicted_start_date)} — {formatDate(f.predicted_end_date)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {f.actual_start_date
                          ? `${formatDate(f.actual_start_date)} — ${formatDate(f.actual_end_date) || '?'}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {calcDays(f.predicted_start_date, f.predicted_end_date) ?? '?'} dias
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[f.status] || ''}`}>
                          {STATUS_LABELS[f.status] || f.status}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="text-xs text-muted-foreground line-clamp-2">{f.notes || '—'}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canManage && f.status === 'pendente' && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Aprovar"
                                onClick={() => handleQuickStatus(f.id, 'aprovado')}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Cancelar"
                                onClick={() => handleQuickStatus(f.id, 'cancelado')}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          {canManage && f.status === 'aprovado' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Marcar como Em Andamento"
                              onClick={() => handleQuickStatus(f.id, 'em_andamento')}
                            >
                              <Clock className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(f)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover registro?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(f.id)} className="bg-destructive hover:bg-destructive/90">
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Dialog: criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFerias ? 'Editar Férias' : 'Registrar Férias'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {canManage && (
              <div className="space-y-2">
                <Label>Usuário *</Label>
                <Select value={formData.user_id} onValueChange={v => setFormData(p => ({ ...p, user_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o usuário" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {users.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')).map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início previsto *</Label>
                <Input type="date" value={formData.predicted_start_date}
                  onChange={e => setFormData(p => ({ ...p, predicted_start_date: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Término previsto *</Label>
                <Input type="date" value={formData.predicted_end_date}
                  onChange={e => setFormData(p => ({ ...p, predicted_end_date: e.target.value }))} required />
              </div>
            </div>

            {formData.predicted_start_date && formData.predicted_end_date && (
              <p className="text-sm text-muted-foreground">
                Total previsto: <strong>{calcDays(formData.predicted_start_date, formData.predicted_end_date) ?? 0} dias</strong>
                {' '}(limite: {config.max_vacation_days} dias)
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início efetivo</Label>
                <Input type="date" value={formData.actual_start_date}
                  onChange={e => setFormData(p => ({ ...p, actual_start_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Término efetivo</Label>
                <Input type="date" value={formData.actual_end_date}
                  onChange={e => setFormData(p => ({ ...p, actual_end_date: e.target.value }))} />
              </div>
            </div>

            {isAdmin && (
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.notes}
                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                placeholder="Informações adicionais..."
                rows={3} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingFerias ? 'Salvar' : 'Registrar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: configurar limite */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Configurar Limite de Férias</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Máximo de dias por ciclo/ano</Label>
              <Input
                type="number"
                min="1"
                max="365"
                value={configForm.max_vacation_days}
                onChange={e => setConfigForm({ max_vacation_days: Number(e.target.value) })}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveConfig}>Salvar</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FeriasPage;
