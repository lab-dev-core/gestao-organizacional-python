import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { ScrollArea } from '../ui/scroll-area';
import {
  ChevronLeft, Play, CheckCircle2, Circle, Clock, Loader2,
  Plus, Upload, Pencil, Trash2, ExternalLink, Video, GraduationCap,
  PlayCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const formatDuration = (seconds) => {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const CourseDetail = ({ stage, subcategory, onVideoSelect, onBack, canManage, getAuthHeaders }) => {
  const fileInputRef = useRef(null);

  const [videos, setVideos] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);

  // Video form
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    video_type: 'upload',
    external_url: '',
    is_public: false
  });

  const fetchVideos = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const res = await axios.get(`${API_URL}/videos`, {
        headers,
        params: { subcategory_id: subcategory.id, limit: 100 }
      });
      const vids = res.data;
      setVideos(vids);

      const progressResults = await Promise.allSettled(
        vids.map(v => axios.get(`${API_URL}/videos/${v.id}/progress`, { headers }))
      );
      const map = {};
      progressResults.forEach((r, i) => {
        if (r.status === 'fulfilled') map[vids[i].id] = r.value.data;
      });
      setProgress(map);
    } catch (err) {
      console.error('Error fetching videos:', err);
    } finally {
      setLoading(false);
    }
  }, [subcategory.id, getAuthHeaders]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const completedCount = videos.filter(v => progress[v.id]?.completed).length;
  const progressPercent = videos.length > 0 ? Math.round((completedCount / videos.length) * 100) : 0;
  const nextVideo = videos.find(v => !progress[v.id]?.completed) || videos[0];

  const resetForm = () => {
    setFormData({ title: '', description: '', category: '', video_type: 'upload', external_url: '', is_public: false });
    setEditingVideo(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenDialog = (video = null) => {
    if (video) {
      setEditingVideo(video);
      setFormData({
        title: video.title,
        description: video.description || '',
        category: video.category || '',
        video_type: video.video_type,
        external_url: video.external_url || '',
        is_public: video.is_public || false
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) {
      toast.error('Formatos permitidos: MP4, AVI, MOV, MKV, WEBM');
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast.error('Tamanho máximo: 500MB');
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingVideo && formData.video_type === 'upload' && !selectedFile) {
      toast.error('Selecione um arquivo');
      return;
    }
    if (formData.video_type === 'link' && !formData.external_url) {
      toast.error('URL externa é obrigatória');
      return;
    }
    setUploading(true);
    try {
      const headers = getAuthHeaders();
      const permissions = {
        location_ids: [], user_ids: [], function_ids: [],
        formative_stage_ids: stage?.id ? [stage.id] : []
      };
      if (editingVideo) {
        await axios.put(`${API_URL}/videos/${editingVideo.id}`, {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          external_url: formData.external_url,
          is_public: formData.is_public,
          permissions,
          formative_stage_id: stage?.id,
          subcategory_id: subcategory.id
        }, { headers });
        toast.success('Vídeo atualizado');
      } else {
        const fd = new FormData();
        if (selectedFile) fd.append('file', selectedFile);
        fd.append('title', formData.title);
        fd.append('description', formData.description || '');
        fd.append('category', formData.category || '');
        fd.append('video_type', formData.video_type);
        fd.append('external_url', formData.external_url || '');
        fd.append('is_public', formData.is_public);
        fd.append('permissions', JSON.stringify(permissions));
        fd.append('formative_stage_id', stage?.id || '');
        fd.append('subcategory_id', subcategory.id);
        fd.append('allow_comments', true);
        fd.append('allow_evaluation', true);
        await axios.post(`${API_URL}/videos`, fd, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Vídeo criado');
      }
      setDialogOpen(false);
      resetForm();
      fetchVideos();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar vídeo');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (videoId) => {
    try {
      await axios.delete(`${API_URL}/videos/${videoId}`, { headers: getAuthHeaders() });
      toast.success('Vídeo removido');
      fetchVideos();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao remover vídeo');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="text-sm text-muted-foreground">
            <span>{stage?.name}</span>
            <span className="mx-2">/</span>
            <span className="text-foreground font-medium">{subcategory.name}</span>
          </div>
        </div>

        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Aula
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingVideo ? 'Editar Aula' : 'Nova Aula'}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!editingVideo && (
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select
                        value={formData.video_type}
                        onValueChange={(v) => setFormData(p => ({ ...p, video_type: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upload">Upload de arquivo</SelectItem>
                          <SelectItem value="link">Link externo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!editingVideo && formData.video_type === 'upload' && (
                    <div className="space-y-2">
                      <Label>Arquivo *</Label>
                      <div
                        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {selectedFile ? selectedFile.name : 'Clique ou arraste o arquivo'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">MP4, AVI, MOV, MKV, WEBM</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".mp4,.avi,.mov,.mkv,.webm"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>
                    </div>
                  )}

                  {formData.video_type === 'link' && (
                    <div className="space-y-2">
                      <Label>URL *</Label>
                      <Input
                        value={formData.external_url}
                        onChange={(e) => setFormData(p => ({ ...p, external_url: e.target.value }))}
                        placeholder="https://youtube.com/watch?v=..."
                      />
                      <p className="text-xs text-muted-foreground">YouTube, Vimeo ou URL direta</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))}
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))}
                      placeholder="Ex: Aula, Tutorial, Palestra"
                    />
                  </div>

                  <DialogFooter className="pt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button type="submit" disabled={uploading}>
                      {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Salvar
                    </Button>
                  </DialogFooter>
                </form>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Course Info */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-0 shadow-md">
            <CardContent className="p-6 space-y-5">
              <div>
                <div className="p-3 rounded-xl bg-amber-500/10 inline-block mb-3">
                  <Video className="w-7 h-7 text-amber-600" />
                </div>
                <h1 className="text-xl font-bold">{subcategory.name}</h1>
                {subcategory.description && (
                  <p className="text-sm text-muted-foreground mt-2">{subcategory.description}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="font-semibold">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {completedCount} de {videos.length} aula{videos.length !== 1 ? 's' : ''} concluída{completedCount !== 1 ? 's' : ''}
                </p>
              </div>

              {videos.length > 0 && (
                <Button
                  className="w-full"
                  onClick={() => nextVideo && onVideoSelect(nextVideo)}
                  disabled={!nextVideo}
                >
                  <PlayCircle className="w-4 h-4 mr-2" />
                  {completedCount === 0 ? 'Começar curso' : completedCount === videos.length ? 'Rever curso' : 'Continuar assistindo'}
                </Button>
              )}

              <div className="flex items-center gap-3 text-sm text-muted-foreground pt-2 border-t">
                <div className="flex items-center gap-1">
                  <Video className="w-4 h-4" />
                  <span>{videos.length} aula{videos.length !== 1 ? 's' : ''}</span>
                </div>
                {stage && (
                  <div className="flex items-center gap-1">
                    <GraduationCap className="w-4 h-4" />
                    <span>{stage.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Video List */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <div className="px-6 py-4 border-b">
                <h2 className="font-semibold">Aulas</h2>
              </div>

              {videos.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground">
                  <Video className="w-12 h-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma aula cadastrada</p>
                  {canManage && (
                    <Button variant="link" onClick={() => handleOpenDialog()} className="mt-2">
                      Adicionar primeira aula
                    </Button>
                  )}
                </div>
              ) : (
                <div className="divide-y">
                  {videos.map((video, index) => {
                    const prog = progress[video.id];
                    const isCompleted = prog?.completed;
                    const isNext = video.id === nextVideo?.id && !isCompleted && completedCount < videos.length;

                    return (
                      <div
                        key={video.id}
                        className={`flex items-center gap-4 px-6 py-4 group hover:bg-muted/50 transition-colors cursor-pointer ${isNext ? 'bg-primary/5' : ''}`}
                        onClick={() => onVideoSelect(video)}
                      >
                        {/* Status icon */}
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                          ) : isNext ? (
                            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <Play className="w-3 h-3 text-primary-foreground ml-0.5" />
                            </div>
                          ) : (
                            <Circle className="w-6 h-6 text-muted-foreground/50" />
                          )}
                        </div>

                        {/* Order number */}
                        <span className="flex-shrink-0 text-sm text-muted-foreground w-6 text-center">
                          {index + 1}
                        </span>

                        {/* Title + info */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${isCompleted ? 'text-muted-foreground' : ''}`}>
                            {video.title}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {video.category && (
                              <Badge variant="secondary" className="text-xs py-0">{video.category}</Badge>
                            )}
                            {video.video_type === 'link' && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> Link
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Duration */}
                        {video.duration && (
                          <div className="flex-shrink-0 flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDuration(video.duration)}
                          </div>
                        )}

                        {/* Admin actions */}
                        {canManage && (
                          <div
                            className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleOpenDialog(video)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja excluir "{video.title}"? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(video.id)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CourseDetail;
