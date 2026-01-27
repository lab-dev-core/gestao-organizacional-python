import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Progress } from '../components/ui/progress';
import { Plus, Search, Pencil, Trash2, Video, Upload, Play, Eye, Loader2, ExternalLink, ChevronLeft, FolderOpen, GraduationCap, Lock } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const VideosPage = () => {
  const { getAuthHeaders, isAdmin, isFormador, user } = useAuth();
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  
  const [videos, setVideos] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);
  const [videoProgress, setVideoProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    video_type: 'upload',
    external_url: '',
    formative_stage_id: '',
    is_public: false
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
      const [videosRes, stagesRes] = await Promise.all([
        axios.get(`${API_URL}/videos`, { headers }),
        axios.get(`${API_URL}/formative-stages`, { headers })
      ]);
      
      setVideos(videosRes.data);
      setStages(stagesRes.data.sort((a, b) => a.order - b.order));

      // Fetch progress for each video
      const progressPromises = videosRes.data.map(video =>
        axios.get(`${API_URL}/videos/${video.id}/progress`, { headers }).catch(() => null)
      );
      const progressResults = await Promise.all(progressPromises);
      const progressMap = {};
      progressResults.forEach((res, idx) => {
        if (res?.data) {
          progressMap[videosRes.data[idx].id] = res.data;
        }
      });
      setVideoProgress(progressMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: '',
      video_type: 'upload',
      external_url: '',
      formative_stage_id: selectedStage?.id || '',
      is_public: false
    });
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
        formative_stage_id: video.formative_stage_id || selectedStage?.id || '',
        is_public: video.is_public || false
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      const allowed = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
      if (!allowed.includes(ext)) {
        toast.error(`${t('allowedFormats')}: ${allowed.join(', ')}`);
        return;
      }
      if (file.size > 500 * 1024 * 1024) {
        toast.error(`${t('maxSize')}: 500MB`);
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!editingVideo && formData.video_type === 'upload' && !selectedFile) {
      toast.error(t('selectFile'));
      return;
    }

    if (formData.video_type === 'link' && !formData.external_url) {
      toast.error('URL externa é obrigatória');
      return;
    }

    setUploading(true);
    try {
      const headers = getAuthHeaders();

      // Build permissions based on formative stage
      const permissions = {
        location_ids: [],
        user_ids: [],
        function_ids: [],
        formative_stage_ids: formData.formative_stage_id ? [formData.formative_stage_id] : []
      };

      if (editingVideo) {
        await axios.put(`${API_URL}/videos/${editingVideo.id}`, {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          external_url: formData.external_url,
          is_public: formData.is_public,
          permissions: permissions,
          formative_stage_id: formData.formative_stage_id
        }, { headers });
        toast.success(t('videoUpdated'));
      } else {
        const fd = new FormData();
        if (selectedFile) {
          fd.append('file', selectedFile);
        }
        fd.append('title', formData.title);
        fd.append('description', formData.description);
        fd.append('category', formData.category);
        fd.append('video_type', formData.video_type);
        fd.append('external_url', formData.external_url);
        fd.append('is_public', formData.is_public);
        fd.append('permissions', JSON.stringify(permissions));
        fd.append('formative_stage_id', formData.formative_stage_id);

        await axios.post(`${API_URL}/videos`, fd, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        });
        toast.success(t('videoCreated'));
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving video:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (videoId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/videos/${videoId}`, { headers });
      toast.success(t('videoDeleted'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const handleWatchVideo = (video) => {
    setCurrentVideo(video);
    setPlayerOpen(true);
  };

  const getVideoSrc = (video) => {
    if (video.video_type === 'link') {
      if (video.external_url?.includes('youtube.com') || video.external_url?.includes('youtu.be')) {
        const videoId = video.external_url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1];
        return videoId ? `https://www.youtube.com/embed/${videoId}` : video.external_url;
      }
      if (video.external_url?.includes('vimeo.com')) {
        const videoId = video.external_url.match(/vimeo\.com\/(\d+)/)?.[1];
        return videoId ? `https://player.vimeo.com/video/${videoId}` : video.external_url;
      }
      return video.external_url;
    }
    return `${process.env.REACT_APP_BACKEND_URL}${video.file_url}`;
  };

  const isEmbeddedVideo = (video) => {
    if (video.video_type === 'link') {
      return video.external_url?.includes('youtube') || video.external_url?.includes('vimeo');
    }
    return false;
  };

  // Get video count for each stage
  const getStageVideoCount = (stageId) => {
    return videos.filter(video => video.formative_stage_id === stageId).length;
  };

  // Get videos without stage (general/public)
  const getGeneralVideos = () => {
    return videos.filter(video => !video.formative_stage_id || video.is_public);
  };

  // Get videos for selected stage
  const getStageVideos = () => {
    if (!selectedStage) return [];
    return videos.filter(video => 
      video.formative_stage_id === selectedStage.id || 
      (video.is_public && !video.formative_stage_id)
    );
  };

  const filteredVideos = (selectedStage ? getStageVideos() : getGeneralVideos()).filter(video => {
    return video.title?.toLowerCase().includes(search.toLowerCase()) ||
           video.description?.toLowerCase().includes(search.toLowerCase());
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
      <div className="space-y-6" data-testid="videos-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('videos')}</h1>
          <p className="text-muted-foreground mt-1">
            Selecione uma etapa formativa para acessar os vídeos
          </p>
        </div>

        {/* Stages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stages.map((stage) => {
            const hasAccess = hasAccessToStage(stage.id);
            const videoCount = getStageVideoCount(stage.id);
            
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
                      hasAccess ? 'bg-amber-500/10' : 'bg-muted'
                    }`}>
                      {hasAccess ? (
                        <Video className={`w-8 h-8 ${hasAccess ? 'text-amber-600' : 'text-muted-foreground'}`} />
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
                      <Video className="w-4 h-4" />
                      <span>{videoCount} {videoCount === 1 ? 'vídeo' : 'vídeos'}</span>
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
                <p className="text-sm mt-2">Cadastre etapas formativas para organizar os vídeos</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* General Videos Section */}
        {getGeneralVideos().length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Vídeos Gerais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {getGeneralVideos().slice(0, 6).map(video => (
                <Card key={video.id} className="border-0 shadow-md overflow-hidden card-hover">
                  <div 
                    className="aspect-video bg-muted relative cursor-pointer group"
                    onClick={() => handleWatchVideo(video)}
                  >
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                      <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-7 h-7 text-primary ml-1" />
                      </div>
                    </div>
                    {video.video_type === 'link' && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="bg-white/90">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Link
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-semibold line-clamp-1">{video.title}</h3>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Eye className="w-4 h-4" />
                      {video.views}
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

  // Videos List View (inside a stage)
  return (
    <div className="space-y-6" data-testid="videos-stage-view">
      {/* Video Player Modal */}
      <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
        <DialogContent className="max-w-4xl p-0">
          <div className="aspect-video bg-black rounded-t-lg overflow-hidden">
            {currentVideo && (
              isEmbeddedVideo(currentVideo) ? (
                <iframe
                  src={getVideoSrc(currentVideo)}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              ) : (
                <video
                  src={getVideoSrc(currentVideo)}
                  controls
                  className="w-full h-full"
                  autoPlay
                />
              )
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-lg">{currentVideo?.title}</h3>
            {currentVideo?.description && (
              <p className="text-muted-foreground mt-1">{currentVideo.description}</p>
            )}
          </div>
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
              {filteredVideos.length} {t('videos').toLowerCase()}
              {selectedStage.estimated_duration && ` • ${selectedStage.estimated_duration}`}
            </p>
          </div>
        </div>
        
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="new-video-btn">
                <Plus className="w-4 h-4 mr-2" />
                {t('newVideo')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingVideo ? t('editVideo') : t('newVideo')}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!editingVideo && (
                    <div className="space-y-2">
                      <Label>{t('videoType')}</Label>
                      <Select
                        value={formData.video_type}
                        onValueChange={(v) => setFormData(prev => ({ ...prev, video_type: v }))}
                      >
                        <SelectTrigger data-testid="video-type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="upload">{t('uploadVideo')}</SelectItem>
                          <SelectItem value="link">{t('externalLink')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!editingVideo && formData.video_type === 'upload' && (
                    <div className="space-y-2">
                      <Label>{t('selectFile')} *</Label>
                      <div 
                        className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {selectedFile ? selectedFile.name : t('dragDrop')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          MP4, AVI, MOV, MKV, WEBM
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".mp4,.avi,.mov,.mkv,.webm"
                          onChange={handleFileChange}
                          className="hidden"
                          data-testid="video-file-input"
                        />
                      </div>
                    </div>
                  )}

                  {formData.video_type === 'link' && (
                    <div className="space-y-2">
                      <Label>{t('externalUrl')} *</Label>
                      <Input
                        value={formData.external_url}
                        onChange={(e) => setFormData(prev => ({ ...prev, external_url: e.target.value }))}
                        placeholder="https://youtube.com/watch?v=..."
                        data-testid="video-url-input"
                      />
                      <p className="text-xs text-muted-foreground">YouTube, Vimeo ou URL direta</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>{t('title')} *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                      data-testid="video-title-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('category')}</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="Ex: Aula, Palestra, Tutorial"
                      data-testid="video-category-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('description')}</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      data-testid="video-description-input"
                    />
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Etapa: {selectedStage.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Este vídeo será acessível apenas para usuários desta etapa formativa
                    </p>
                  </div>

                  <DialogFooter className="pt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">{t('cancel')}</Button>
                    </DialogClose>
                    <Button type="submit" disabled={uploading} data-testid="video-submit-btn">
                      {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {t('save')}
                    </Button>
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
              placeholder={`${t('search')}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              data-testid="videos-search-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Videos Grid */}
      {filteredVideos.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center text-muted-foreground">
            <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Nenhum vídeo nesta etapa</p>
            {canManage && (
              <Button
                variant="link"
                onClick={() => handleOpenDialog()}
                className="mt-2"
              >
                Adicionar primeiro vídeo
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map(video => (
            <Card key={video.id} className="border-0 shadow-md overflow-hidden card-hover" data-testid={`video-card-${video.id}`}>
              <div 
                className="aspect-video bg-muted relative cursor-pointer group"
                onClick={() => handleWatchVideo(video)}
              >
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-primary ml-1" />
                  </div>
                </div>
                {video.video_type === 'link' && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-white/90">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Link
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold line-clamp-1">{video.title}</h3>
                {video.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
                )}
                
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {video.views}
                  </div>
                  {video.category && (
                    <Badge variant="secondary" className="text-xs">{video.category}</Badge>
                  )}
                </div>

                {/* Progress bar */}
                {videoProgress[video.id] && !videoProgress[video.id].completed && (
                  <div className="mt-3">
                    <Progress value={30} className="h-1" />
                    <p className="text-xs text-muted-foreground mt-1">Em andamento</p>
                  </div>
                )}
                {videoProgress[video.id]?.completed && (
                  <Badge variant="outline" className="mt-3 border-green-500 text-green-600">
                    {t('completed')}
                  </Badge>
                )}

                {/* Actions */}
                {canManage && (
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleOpenDialog(video); }}
                      data-testid={`edit-video-${video.id}`}
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      {t('edit')}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`delete-video-${video.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          {t('delete')}
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
                          <AlertDialogAction onClick={() => handleDelete(video.id)}>
                            {t('delete')}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default VideosPage;
