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
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Plus, Video, ChevronLeft, GraduationCap, Lock, Layers, Pencil, Trash2, Loader2, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import CourseDetail from '../components/videos/CourseDetail';
import VideoPlayerView from '../components/videos/VideoPlayerView';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const VideosPage = () => {
  const { getAuthHeaders, isAdmin, isFormador, user } = useAuth();
  const { t } = useLanguage();

  // Navigation state
  const [selectedStage, setSelectedStage] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [courseVideos, setCourseVideos] = useState([]);

  // Data
  const [stages, setStages] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [videoProgress, setVideoProgress] = useState({});
  const [loading, setLoading] = useState(true);

  // Subcategory dialog
  const [subcategoryDialogOpen, setSubcategoryDialogOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [subcategoryFormData, setSubcategoryFormData] = useState({ name: '', description: '' });
  const [savingSubcategory, setSavingSubcategory] = useState(false);

  const canManage = isAdmin || isFormador;

  const hasAccessToStage = (stageId) => {
    if (isAdmin || isFormador) return true;
    if (!user?.formative_stage_id || stages.length === 0) return false;
    const userStage = stages.find(s => s.id === user.formative_stage_id);
    const targetStage = stages.find(s => s.id === stageId);
    if (!userStage || !targetStage) return false;
    return targetStage.order <= userStage.order;
  };

  const getStageAccessType = (stage) => {
    if (isAdmin || isFormador) return 'manage';
    if (!user?.formative_stage_id || stages.length === 0) return 'locked';
    const userStage = stages.find(s => s.id === user.formative_stage_id);
    if (!userStage) return 'locked';
    if (stage.order < userStage.order) return 'past';
    if (stage.order === userStage.order) return 'current';
    return 'future';
  };

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const fetchStages = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const res = await axios.get(`${API_URL}/formative-stages`, { headers });
      setStages(res.data.sort((a, b) => a.order - b.order));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  const fetchSubcategories = useCallback(async (stageId) => {
    try {
      const headers = getAuthHeaders();
      const res = await axios.get(`${API_URL}/content-subcategories`, {
        headers,
        params: { formative_stage_id: stageId, content_type: 'video' }
      });
      setSubcategories(res.data);

      // Fetch progress for all videos in these subcategories to show badges on Screen 2
      const allVideoIds = [];
      await Promise.allSettled(
        res.data.map(async (sub) => {
          const vRes = await axios.get(`${API_URL}/videos`, {
            headers,
            params: { subcategory_id: sub.id, limit: 100 }
          });
          vRes.data.forEach(v => allVideoIds.push(v.id));
        })
      );

      const progressResults = await Promise.allSettled(
        allVideoIds.map(id => axios.get(`${API_URL}/videos/${id}/progress`, { headers }))
      );
      const map = {};
      progressResults.forEach((r, i) => {
        if (r.status === 'fulfilled') map[allVideoIds[i]] = r.value.data;
      });
      setVideoProgress(map);
    } catch (err) {
      console.error(err);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  useEffect(() => {
    if (selectedStage) {
      fetchSubcategories(selectedStage.id);
    } else {
      setSubcategories([]);
      setVideoProgress({});
    }
  }, [selectedStage, fetchSubcategories]);

  // ─── Subcategory CRUD ───────────────────────────────────────────────────────

  const handleOpenSubcategoryDialog = (sub = null) => {
    setEditingSubcategory(sub);
    setSubcategoryFormData({ name: sub?.name || '', description: sub?.description || '' });
    setSubcategoryDialogOpen(true);
  };

  const handleSaveSubcategory = async (e) => {
    e.preventDefault();
    setSavingSubcategory(true);
    try {
      const headers = getAuthHeaders();
      if (editingSubcategory) {
        await axios.put(`${API_URL}/content-subcategories/${editingSubcategory.id}`, subcategoryFormData, { headers });
        toast.success('Subcategoria atualizada');
      } else {
        await axios.post(`${API_URL}/content-subcategories`, {
          ...subcategoryFormData,
          formative_stage_id: selectedStage.id,
          content_type: 'video',
          order: subcategories.length
        }, { headers });
        toast.success('Subcategoria criada');
      }
      setSubcategoryDialogOpen(false);
      fetchSubcategories(selectedStage.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar');
    } finally {
      setSavingSubcategory(false);
    }
  };

  const handleDeleteSubcategory = async (subId) => {
    try {
      await axios.delete(`${API_URL}/content-subcategories/${subId}`, { headers: getAuthHeaders() });
      toast.success('Subcategoria removida');
      fetchSubcategories(selectedStage.id);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao remover');
    }
  };

  // ─── Course entry point ─────────────────────────────────────────────────────

  const handleEnterCourse = async (sub) => {
    setSelectedSubcategory(sub);
    // Fetch videos for this subcategory to pass to player later
    try {
      const res = await axios.get(`${API_URL}/videos`, {
        headers: getAuthHeaders(),
        params: { subcategory_id: sub.id, limit: 100 }
      });
      setCourseVideos(res.data);
    } catch (err) {
      setCourseVideos([]);
    }
  };

  const handleVideoSelect = async (video) => {
    // Refresh course videos list if needed
    if (courseVideos.length === 0) {
      try {
        const res = await axios.get(`${API_URL}/videos`, {
          headers: getAuthHeaders(),
          params: { subcategory_id: selectedSubcategory.id, limit: 100 }
        });
        setCourseVideos(res.data);
      } catch (err) {
        setCourseVideos([]);
      }
    }
    setSelectedVideo(video);
  };

  const handleVideoChange = (video) => {
    setSelectedVideo(video);
  };

  // ─── Subcategory progress helpers ──────────────────────────────────────────

  const getSubcategoryStatus = (sub) => {
    const total = sub.video_count;
    if (total === 0) return { label: null, percent: 0, completed: 0 };

    // We use videoProgress which was fetched per video, but we don't easily know which videos
    // belong to this subcategory without an extra fetch. Show a rough estimate.
    // For now return null status (will be shown when entering the course).
    return { label: null, percent: 0, completed: 0 };
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Screen 4: Video Player ─────────────────────────────────────────────────
  if (selectedVideo) {
    return (
      <VideoPlayerView
        video={selectedVideo}
        allVideos={courseVideos}
        stage={selectedStage}
        subcategory={selectedSubcategory}
        onVideoChange={handleVideoChange}
        onBack={() => setSelectedVideo(null)}
        getAuthHeaders={getAuthHeaders}
        user={user}
        canManage={canManage}
      />
    );
  }

  // ─── Screen 3: Course Detail ────────────────────────────────────────────────
  if (selectedSubcategory) {
    return (
      <CourseDetail
        stage={selectedStage}
        subcategory={selectedSubcategory}
        onVideoSelect={handleVideoSelect}
        onBack={() => {
          setSelectedSubcategory(null);
          setCourseVideos([]);
        }}
        canManage={canManage}
        getAuthHeaders={getAuthHeaders}
      />
    );
  }

  // ─── Screen 2: Subcategory / Course Cards ───────────────────────────────────
  if (selectedStage) {
    return (
      <div className="space-y-6" data-testid="videos-subcategory-view">
        {/* Subcategory Dialog */}
        <Dialog open={subcategoryDialogOpen} onOpenChange={setSubcategoryDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingSubcategory ? 'Editar Módulo' : 'Novo Módulo'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveSubcategory} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={subcategoryFormData.name}
                  onChange={(e) => setSubcategoryFormData(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Módulo 1, Introdução, Bloco A..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={subcategoryFormData.description}
                  onChange={(e) => setSubcategoryFormData(p => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Descrição do módulo"
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancelar</Button>
                </DialogClose>
                <Button type="submit" disabled={savingSubcategory}>
                  {savingSubcategory && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSelectedStage(null)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{selectedStage.name}</h1>
              </div>
              <p className="text-muted-foreground mt-1">
                {subcategories.length} módulo{subcategories.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {canManage && (
            <Button onClick={() => handleOpenSubcategoryDialog()} data-testid="new-subcategory-btn">
              <Plus className="w-4 h-4 mr-2" />
              Novo Módulo
            </Button>
          )}
        </div>

        {/* Course Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {subcategories.map((sub) => (
            <Card
              key={sub.id}
              className="border-0 shadow-md overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-200 group"
              onClick={() => handleEnterCourse(sub)}
              data-testid={`subcategory-card-${sub.id}`}
            >
              {/* Cover area */}
              <div className="h-32 bg-gradient-to-br from-amber-500/20 to-primary/20 relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur flex items-center justify-center group-hover:scale-110 transition-transform">
                  <PlayCircle className="w-8 h-8 text-amber-600" />
                </div>
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="text-xs bg-white/80 text-foreground">
                    {sub.video_count} {sub.video_count === 1 ? 'aula' : 'aulas'}
                  </Badge>
                </div>
              </div>

              <div className="p-5">
                <h3 className="font-semibold text-base">{sub.name}</h3>
                {sub.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{sub.description}</p>
                )}

                {canManage && (
                  <div
                    className="flex items-center gap-1 mt-4 pt-4 border-t"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenSubcategoryDialog(sub)}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Editar
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o módulo "{sub.name}"? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteSubcategory(sub.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </div>
            </Card>
          ))}

          {subcategories.length === 0 && (
            <Card className="col-span-full border-0 shadow-md">
              <CardContent className="py-16 text-center text-muted-foreground">
                <Layers className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <p className="text-lg">Nenhum módulo cadastrado</p>
                {canManage && (
                  <Button variant="link" onClick={() => handleOpenSubcategoryDialog()} className="mt-2">
                    Criar primeiro módulo
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ─── Screen 1: Stage Selection ──────────────────────────────────────────────
  return (
    <div className="space-y-6" data-testid="videos-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('videos')}</h1>
        <p className="text-muted-foreground mt-1">
          Selecione uma etapa formativa para acessar os vídeos
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {stages.map((stage) => {
          const accessType = getStageAccessType(stage);
          const hasAccess = accessType !== 'future' && accessType !== 'locked';
          const isCurrent = accessType === 'current';
          const isPast = accessType === 'past';
          const isFuture = accessType === 'future' || accessType === 'locked';
          return (
            <Card
              key={stage.id}
              className={`border-0 shadow-md overflow-hidden transition-all duration-200 ${
                hasAccess
                  ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1'
                  : 'opacity-60 cursor-not-allowed'
              } ${isCurrent ? 'ring-2 ring-primary' : ''}`}
              onClick={() => hasAccess && setSelectedStage(stage)}
              data-testid={`stage-folder-${stage.id}`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className={`p-4 rounded-xl ${
                    isCurrent ? 'bg-amber-500/20' :
                    isPast ? 'bg-green-500/10' :
                    isFuture ? 'bg-muted' : 'bg-amber-500/10'
                  }`}>
                    {isFuture
                      ? <Lock className="w-8 h-8 text-muted-foreground" />
                      : isPast
                        ? <Video className="w-8 h-8 text-green-600" />
                        : <Video className="w-8 h-8 text-amber-600" />
                    }
                  </div>
                  {isCurrent && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                      Etapa atual
                    </Badge>
                  )}
                  {isPast && (
                    <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 text-xs">
                      Concluída
                    </Badge>
                  )}
                </div>

                <div className="mt-4">
                  <h3 className="font-semibold text-lg">{stage.name}</h3>
                  {stage.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{stage.description}</p>
                  )}
                </div>

                {isFuture && (
                  <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    Conclua as etapas anteriores para desbloquear
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
              <p className="text-sm mt-2">Cadastre etapas formativas para organizar os vídeos</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VideosPage;
