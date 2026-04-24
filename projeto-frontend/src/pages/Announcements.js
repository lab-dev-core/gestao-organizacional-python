import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Plus, Pencil, Trash2, Pin, Megaphone, GraduationCap, Users, Globe, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AnnouncementsPage = () => {
  const { getAuthHeaders, isAdmin, isFormador, user } = useAuth();
  const canManage = isAdmin || isFormador;

  const [announcements, setAnnouncements] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target: 'all',
    formative_stage_id: '',
    target_role: '',
    pinned: false,
    expires_at: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [annRes, stagesRes] = await Promise.allSettled([
        axios.get(`${API_URL}/announcements`, { headers }),
        axios.get(`${API_URL}/formative-stages`, { headers }),
      ]);
      if (annRes.status === 'fulfilled') setAnnouncements(annRes.value.data);
      if (stagesRes.status === 'fulfilled') setStages(stagesRes.value.data.sort((a, b) => a.order - b.order));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setFormData({ title: '', content: '', target: 'all', formative_stage_id: '', target_role: '', pinned: false, expires_at: '' });
    setEditingItem(null);
  };

  const handleOpenDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        title: item.title,
        content: item.content,
        target: item.target || 'all',
        formative_stage_id: item.formative_stage_id || '',
        target_role: item.target_role || '',
        pinned: item.pinned || false,
        expires_at: item.expires_at || '',
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Título e conteúdo são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const headers = getAuthHeaders();
      const payload = { ...formData };
      if (payload.target !== 'stage') delete payload.formative_stage_id;
      if (payload.target !== 'role') delete payload.target_role;
      if (!payload.expires_at) delete payload.expires_at;

      if (editingItem) {
        await axios.put(`${API_URL}/announcements/${editingItem.id}`, payload, { headers });
        toast.success('Comunicado atualizado');
      } else {
        await axios.post(`${API_URL}/announcements`, payload, { headers });
        toast.success('Comunicado publicado');
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
      await axios.delete(`${API_URL}/announcements/${id}`, { headers: getAuthHeaders() });
      toast.success('Comunicado removido');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao remover');
    }
  };

  const getTargetConfig = (ann) => {
    if (ann.target === 'stage') {
      const stage = stages.find(s => s.id === ann.formative_stage_id);
      return { label: stage?.name || 'Etapa específica', icon: GraduationCap, className: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
    if (ann.target === 'role') {
      const roleLabel = { admin: 'Admins', formador: 'Formadores', user: 'Usuários' }[ann.target_role] || ann.target_role;
      return { label: roleLabel, icon: Users, className: 'bg-purple-100 text-purple-700 border-purple-200' };
    }
    return { label: 'Todos', icon: Globe, className: 'bg-green-100 text-green-700 border-green-200' };
  };

  const formatDate = (d) => {
    if (!d) return null;
    try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return d; }
  };

  const isExpired = (ann) => {
    if (!ann.expires_at) return false;
    return new Date(ann.expires_at) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pinned = announcements.filter(a => a.pinned && !isExpired(a));
  const regular = announcements.filter(a => !a.pinned && !isExpired(a));
  const expired = announcements.filter(a => isExpired(a));

  return (
    <div className="space-y-6" data-testid="announcements-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-primary" />
            Comunicados
          </h1>
          <p className="text-muted-foreground mt-1">Avisos e comunicados da organização</p>
        </div>
        {canManage && (
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Comunicado
          </Button>
        )}
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Pin className="w-4 h-4" />
            Fixados
          </h2>
          {pinned.map(ann => <AnnouncementCard key={ann.id} ann={ann} canManage={canManage} onEdit={handleOpenDialog} onDelete={handleDelete} getTargetConfig={getTargetConfig} formatDate={formatDate} currentUser={user} />)}
        </div>
      )}

      {/* Regular */}
      {regular.length > 0 && (
        <div className="space-y-3">
          {pinned.length > 0 && <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recentes</h2>}
          {regular.map(ann => <AnnouncementCard key={ann.id} ann={ann} canManage={canManage} onEdit={handleOpenDialog} onDelete={handleDelete} getTargetConfig={getTargetConfig} formatDate={formatDate} currentUser={user} />)}
        </div>
      )}

      {/* Empty */}
      {pinned.length === 0 && regular.length === 0 && (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Megaphone className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhum comunicado no momento</p>
            {canManage && <Button variant="link" onClick={() => handleOpenDialog()} className="mt-2">Publicar primeiro comunicado</Button>}
          </CardContent>
        </Card>
      )}

      {/* Expired (admin only) */}
      {canManage && expired.length > 0 && (
        <details className="mt-4">
          <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
            {expired.length} comunicado{expired.length !== 1 ? 's' : ''} expirado{expired.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-3 space-y-3 opacity-60">
            {expired.map(ann => <AnnouncementCard key={ann.id} ann={ann} canManage={canManage} onEdit={handleOpenDialog} onDelete={handleDelete} getTargetConfig={getTargetConfig} formatDate={formatDate} currentUser={user} expired />)}
          </div>
        </details>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Comunicado' : 'Novo Comunicado'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Título do comunicado" required />
              </div>

              <div className="space-y-2">
                <Label>Conteúdo *</Label>
                <Textarea value={formData.content} onChange={e => setFormData(p => ({ ...p, content: e.target.value }))} placeholder="Escreva o conteúdo do comunicado..." rows={6} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Destinatários</Label>
                  <Select value={formData.target} onValueChange={v => setFormData(p => ({ ...p, target: v, formative_stage_id: '', target_role: '' }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="stage">Por Etapa</SelectItem>
                      <SelectItem value="role">Por Papel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.target === 'stage' && (
                  <div className="space-y-2">
                    <Label>Etapa</Label>
                    <Select value={formData.formative_stage_id} onValueChange={v => setFormData(p => ({ ...p, formative_stage_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.target === 'role' && (
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select value={formData.target_role} onValueChange={v => setFormData(p => ({ ...p, target_role: v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Usuários</SelectItem>
                        <SelectItem value="formador">Formadores</SelectItem>
                        <SelectItem value="admin">Admins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Data de expiração</Label>
                <Input type="date" value={formData.expires_at} onChange={e => setFormData(p => ({ ...p, expires_at: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Deixe em branco para não expirar</p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <Switch checked={formData.pinned} onCheckedChange={v => setFormData(p => ({ ...p, pinned: v }))} />
                <div>
                  <Label className="text-sm font-medium">Fixar comunicado</Label>
                  <p className="text-xs text-muted-foreground">Comunicados fixados aparecem sempre no topo</p>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingItem ? 'Salvar' : 'Publicar'}
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AnnouncementCard = ({ ann, canManage, onEdit, onDelete, getTargetConfig, formatDate, currentUser, expired }) => {
  const target = getTargetConfig(ann);
  const TargetIcon = target.icon;
  const canEdit = canManage && (ann.created_by_id === currentUser?.id || true);

  return (
    <Card className={`border-0 shadow-md ${ann.pinned ? 'ring-1 ring-primary/20 bg-primary/[0.02]' : ''} ${expired ? 'opacity-70' : ''}`}>
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {ann.pinned && <Pin className="w-4 h-4 text-primary flex-shrink-0" />}
                <h3 className="font-semibold text-base">{ann.title}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${target.className}`}>
                  <TargetIcon className="w-3 h-3" />
                  {target.label}
                </span>
                {expired && <Badge variant="outline" className="text-xs text-muted-foreground">Expirado</Badge>}
              </div>
            </div>

            <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap leading-relaxed">{ann.content}</p>

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
              <span>Por {ann.created_by_name}</span>
              <span>{formatDate(ann.created_at)}</span>
              {ann.expires_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Expira {formatDate(ann.expires_at)}
                </span>
              )}
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => onEdit(ann)}>
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
                    <AlertDialogTitle>Remover comunicado?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(ann.id)} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default AnnouncementsPage;
