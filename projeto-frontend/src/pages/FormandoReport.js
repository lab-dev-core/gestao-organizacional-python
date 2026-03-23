import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import {
  BarChart2, BookOpen, Video, ClipboardList, CheckCircle2,
  User, Loader2, FileText, Play, MessageSquare, TrendingUp,
  GraduationCap, ChevronRight
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const StatCard = ({ icon: Icon, label, value, color = 'primary' }) => {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colorMap[color] || colorMap.primary}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
};

const FormandoReport = () => {
  const { getAuthHeaders, isAdmin, isFormador, user } = useAuth();

  const [formandos, setFormandos] = useState([]);
  const [selectedFormando, setSelectedFormando] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingFormandos, setLoadingFormandos] = useState(true);

  const fetchFormandos = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      let data = [];
      if (isAdmin) {
        // Admin vê todos os usuários (exceto superadmin)
        const res = await axios.get(`${API_URL}/users`, { headers, params: { limit: 200 } });
        data = res.data.filter(u => {
          const roles = u.roles || (u.role ? [u.role] : []);
          return !roles.includes('superadmin');
        });
      } else if (isFormador) {
        try {
          const res = await axios.get(`${API_URL}/acompanhamentos/my-formandos`, { headers });
          data = res.data;
        } catch {
          // Fallback: se endpoint falhar, busca todos os usuários comuns
          const res = await axios.get(`${API_URL}/users`, { headers, params: { limit: 200 } });
          data = res.data.filter(u => {
            const roles = u.roles || (u.role ? [u.role] : []);
            return roles.includes('user') || roles.length === 0;
          });
        }
      } else {
        // Regular user - show their own report
        data = [user];
      }
      setFormandos(data);
      if (!isAdmin && !isFormador && user) {
        setSelectedFormando(user.id);
      }
    } catch (err) {
      console.error('Error fetching formandos:', err);
    } finally {
      setLoadingFormandos(false);
    }
  }, [getAuthHeaders, isAdmin, isFormador, user]);

  const fetchReport = useCallback(async (userId) => {
    if (!userId) return;
    setLoading(true);
    setReport(null);
    try {
      const headers = getAuthHeaders();

      // Fetch all data in parallel
      const [
        acompRes,
        videosRes,
        docsRes,
        stagesRes,
        userRes
      ] = await Promise.allSettled([
        axios.get(`${API_URL}/acompanhamentos`, { headers, params: { user_id: userId, limit: 100 } }),
        axios.get(`${API_URL}/videos`, { headers, params: { limit: 200 } }),
        axios.get(`${API_URL}/documents`, { headers, params: { limit: 200 } }),
        axios.get(`${API_URL}/formative-stages`, { headers }),
        axios.get(`${API_URL}/users/${userId}`, { headers })
      ]);

      const acompanhamentos = acompRes.status === 'fulfilled' ? acompRes.value.data : [];
      const allVideos = videosRes.status === 'fulfilled' ? videosRes.value.data : [];
      const allDocs = docsRes.status === 'fulfilled' ? docsRes.value.data : [];
      const stages = stagesRes.status === 'fulfilled' ? stagesRes.value.data : [];
      const targetUser = userRes.status === 'fulfilled' ? userRes.value.data : null;

      // Fetch video progress for each video
      const videoProgressMap = {};
      await Promise.allSettled(
        allVideos.map(async (v) => {
          try {
            const res = await axios.get(`${API_URL}/videos/${v.id}/progress`, { headers });
            videoProgressMap[v.id] = res.data;
          } catch {
            videoProgressMap[v.id] = { completed: false };
          }
        })
      );

      // Fetch document read status batch
      let docReadMap = {};
      if (allDocs.length > 0) {
        try {
          const ids = allDocs.map(d => d.id).join(',');
          const res = await axios.get(`${API_URL}/documents/read-status/batch`, {
            headers,
            params: { document_ids: ids }
          });
          docReadMap = res.data;
        } catch {}
      }

      // Calculate stats
      const videosCompleted = allVideos.filter(v => videoProgressMap[v.id]?.completed).length;
      const docsRead = allDocs.filter(d => docReadMap[d.id]?.completed).length;

      const videoProgress = allVideos.length > 0
        ? Math.round((videosCompleted / allVideos.length) * 100)
        : 0;

      const docProgress = allDocs.length > 0
        ? Math.round((docsRead / allDocs.length) * 100)
        : 0;

      const overallProgress = (allVideos.length + allDocs.length) > 0
        ? Math.round(((videosCompleted + docsRead) / (allVideos.length + allDocs.length)) * 100)
        : 0;

      // Group by formative stage
      const stageStats = stages.map(stage => {
        const stageVideos = allVideos.filter(v => v.formative_stage_id === stage.id);
        const stageDocs = allDocs.filter(d => d.formative_stage_id === stage.id);
        const stageAcomps = acompanhamentos.filter(a => a.formative_stage_id === stage.id);

        const completedVideos = stageVideos.filter(v => videoProgressMap[v.id]?.completed).length;
        const readDocs = stageDocs.filter(d => docReadMap[d.id]?.completed).length;

        const total = stageVideos.length + stageDocs.length;
        const done = completedVideos + readDocs;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;

        return {
          stage,
          videos: { total: stageVideos.length, completed: completedVideos },
          docs: { total: stageDocs.length, read: readDocs },
          acompanhamentos: stageAcomps.length,
          progress
        };
      }).filter(s => s.videos.total + s.docs.total + s.acompanhamentos > 0);

      setReport({
        user: targetUser,
        acompanhamentos,
        videosCompleted,
        totalVideos: allVideos.length,
        videoProgress,
        docsRead,
        totalDocs: allDocs.length,
        docProgress,
        overallProgress,
        stageStats
      });
    } catch (err) {
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchFormandos();
  }, [fetchFormandos]);

  useEffect(() => {
    if (selectedFormando) {
      fetchReport(selectedFormando);
    }
  }, [selectedFormando, fetchReport]);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const selectedUser = formandos.find(f => f.id === selectedFormando);

  return (
    <div className="space-y-6" data-testid="formando-report-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <BarChart2 className="w-8 h-8 text-primary" />
          Relatório Individual do Formando
        </h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe o progresso de consumo de conteúdo e acompanhamentos
        </p>
      </div>

      {(isAdmin || isFormador) && (
        <Card className="border-0 shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <User className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <Select value={selectedFormando || ''} onValueChange={setSelectedFormando}>
                  <SelectTrigger className="w-full max-w-sm">
                    <SelectValue placeholder={formandos.length === 0 ? 'Nenhum formando encontrado' : 'Selecione um formando...'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {formandos.length === 0 ? (
                      <div className="py-4 text-center text-sm text-muted-foreground">
                        Nenhum formando disponível
                      </div>
                    ) : (
                      formandos
                        .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''))
                        .map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.full_name}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              {loadingFormandos && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="text-center space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Gerando relatório...</p>
          </div>
        </div>
      )}

      {!loading && !report && !selectedFormando && (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center text-muted-foreground">
            <BarChart2 className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Selecione um formando</p>
            <p className="text-sm mt-1">Escolha um formando para visualizar seu relatório de progresso</p>
          </CardContent>
        </Card>
      )}

      {!loading && report && (
        <div className="space-y-6">
          {/* User Header */}
          <Card className="border-0 shadow-md overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center gap-5">
                <Avatar className="h-20 w-20 border-4 border-primary/20">
                  {report.user?.photo_url ? (
                    <img src={`${process.env.REACT_APP_BACKEND_URL}${report.user.photo_url}`} alt={report.user.full_name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                      {getInitials(report.user?.full_name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">{report.user?.full_name}</h2>
                  <p className="text-muted-foreground">{report.user?.email}</p>
                  {report.user?.username && (
                    <p className="text-sm text-muted-foreground">@{report.user.username}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline">Progresso geral: {report.overallProgress}%</Badge>
                    <Badge variant="outline">{report.acompanhamentos.length} acompanhamentos</Badge>
                  </div>
                </div>
                {/* Overall Progress Ring */}
                <div className="hidden sm:flex flex-col items-center gap-2">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/20" />
                      <circle
                        cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        strokeDashoffset={`${2 * Math.PI * 34 * (1 - report.overallProgress / 100)}`}
                        className="text-primary transition-all duration-1000"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold">{report.overallProgress}%</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">Progresso</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              icon={Video}
              label={`${report.videosCompleted}/${report.totalVideos} vídeos assistidos`}
              value={`${report.videoProgress}%`}
              color="blue"
            />
            <StatCard
              icon={BookOpen}
              label={`${report.docsRead}/${report.totalDocs} documentos lidos`}
              value={`${report.docProgress}%`}
              color="green"
            />
            <StatCard
              icon={ClipboardList}
              label="Acompanhamentos realizados"
              value={report.acompanhamentos.length}
              color="purple"
            />
            <StatCard
              icon={TrendingUp}
              label="Progresso geral do conteúdo"
              value={`${report.overallProgress}%`}
              color="amber"
            />
          </div>

          {/* Progress by Formative Stage */}
          {report.stageStats.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <GraduationCap className="w-5 h-5" />
                  Progresso por Etapa Formativa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {report.stageStats.map(({ stage, videos, docs, acompanhamentos: acompCount, progress }) => (
                  <div key={stage.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">{stage.order}</Badge>
                        <span className="font-medium text-sm">{stage.name}</span>
                      </div>
                      <span className="text-sm font-semibold">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        {videos.completed}/{videos.total} vídeos
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {docs.read}/{docs.total} documentos
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="w-3 h-3" />
                        {acompCount} acompanhamentos
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent Accompaniments */}
          {report.acompanhamentos.length > 0 && (
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <MessageSquare className="w-5 h-5" />
                  Últimos Acompanhamentos ({report.acompanhamentos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-64">
                  <div className="space-y-3">
                    {report.acompanhamentos.slice(0, 10).map(acomp => (
                      <div key={acomp.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{acomp.formador_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(acomp.date + 'T00:00:00').toLocaleDateString('pt-BR', {
                                day: '2-digit', month: 'short', year: 'numeric'
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{acomp.content}</p>
                          {acomp.location && (
                            <p className="text-xs text-muted-foreground mt-1">📍 {acomp.location}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default FormandoReport;
