import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Users, FileText, Video, MapPin, Briefcase, GraduationCap, Activity, TrendingUp, Cake, Heart } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Dashboard = () => {
  const { user, getAuthHeaders } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/stats/dashboard`, {
        headers: getAuthHeaders()
      });
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const StatCard = ({ icon: Icon, title, value, subtitle, color }) => (
    <Card className="card-hover border-0 shadow-md" data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const formatAction = (action) => {
    const actionTranslations = {
      login: 'Login', register: 'Cadastro', create: 'Criou',
      update: 'Atualizou', delete: 'Excluiu', view: 'Visualizou',
      download: 'Baixou', upload: 'Enviou'
    };
    return actionTranslations[action] || action;
  };

  const formatResourceType = (type) => {
    const typeTranslations = {
      user: 'usuário', document: 'documento', video: 'vídeo',
      location: 'local', function: 'função', formative_stage: 'etapa'
    };
    return typeTranslations[type] || type;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatBirthday = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return `${parts[2]}/${parts[1]}`;
  };

  const formatAnniversaryYears = (dateStr) => {
    if (!dateStr || dateStr.length < 4) return null;
    const year = parseInt(dateStr.slice(0, 4));
    const years = new Date().getFullYear() - year;
    return years > 0 ? years : null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="dashboard-loading">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const todayBirthdays = stats?.birthdays?.today || [];
  const monthBirthdays = stats?.birthdays?.month || [];
  const todayConsagracao = stats?.consagracao?.today || [];
  const monthConsagracao = stats?.consagracao?.month || [];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Welcome Section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('welcome')}, {user?.full_name}!
        </p>
      </div>

      {/* Aniversariantes do Dia — destaque */}
      {(todayBirthdays.length > 0 || todayConsagracao.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {todayBirthdays.length > 0 && (
            <Card className="border-0 shadow-md bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <Cake className="w-4 h-4" />
                  🎂 Aniversariantes de Hoje!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {todayBirthdays.map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-rose-100 text-rose-700 dark:bg-rose-900/50">
                        {getInitials(u.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{u.full_name}</p>
                      {u.years && (
                        <p className="text-xs text-muted-foreground">{u.years} anos</p>
                      )}
                    </div>
                    <Badge variant="outline" className="ml-auto text-xs border-rose-300 text-rose-600">
                      🎉 Hoje
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {todayConsagracao.length > 0 && (
            <Card className="border-0 shadow-md bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-violet-600 dark:text-violet-400">
                  <Heart className="w-4 h-4" />
                  ✨ Aniversário de Consagração Hoje!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {todayConsagracao.map(u => (
                  <div key={u.id} className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/50">
                        {getInitials(u.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{u.full_name}</p>
                      {u.years && (
                        <p className="text-xs text-muted-foreground">{u.years} ano{u.years !== 1 ? 's' : ''} na comunidade</p>
                      )}
                    </div>
                    <Badge variant="outline" className="ml-auto text-xs border-violet-300 text-violet-600">
                      🙏 Hoje
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard icon={Users} title={t('totalUsers')} value={stats?.users?.total || 0}
          subtitle={`${stats?.users?.active || 0} ${t('active').toLowerCase()}`} color="bg-indigo-600" />
        <StatCard icon={FileText} title={t('totalDocuments')} value={stats?.content?.documents || 0} color="bg-emerald-600" />
        <StatCard icon={Video} title={t('totalVideos')} value={stats?.content?.videos || 0} color="bg-amber-600" />
        <StatCard icon={MapPin} title={t('locations')} value={stats?.organization?.locations || 0} color="bg-rose-600" />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              {t('users')} por Tipo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('admin')}</span>
              <span className="font-semibold text-indigo-600">{stats?.users?.admins || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('formadorRole')}</span>
              <span className="font-semibold text-blue-600">{stats?.users?.formadores || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('user')}</span>
              <span className="font-semibold text-green-600">{stats?.users?.common_users || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Organização
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('functions')}</span>
              <span className="font-semibold">{stats?.organization?.functions || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('formativeStages')}</span>
              <span className="font-semibold">{stats?.organization?.formative_stages || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('locations')}</span>
              <span className="font-semibold">{stats?.organization?.locations || 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('documents')}</span>
              <span className="font-semibold text-emerald-600">{stats?.content?.documents || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('videos')}</span>
              <span className="font-semibold text-amber-600">{stats?.content?.videos || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aniversariantes do Mês */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Nascimento */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cake className="w-5 h-5 text-rose-500" />
              Aniversariantes do Mês
              {monthBirthdays.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{monthBirthdays.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthBirthdays.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum aniversariante este mês</p>
            ) : (
              <ScrollArea className="max-h-52">
                <div className="space-y-2 pr-2">
                  {monthBirthdays.map(u => {
                    const isToday = todayBirthdays.some(b => b.id === u.id);
                    return (
                      <div key={u.id} className={`flex items-center gap-2 p-2 rounded-lg ${isToday ? 'bg-rose-50 dark:bg-rose-950/30' : 'hover:bg-muted/40'}`}>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">{getInitials(u.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm flex-1 truncate">{u.full_name}</span>
                        <span className="text-xs text-muted-foreground">{formatBirthday(u.birth_date)}</span>
                        {isToday && <span className="text-xs">🎂</span>}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Consagração */}
        <Card className="border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Heart className="w-5 h-5 text-violet-500" />
              Aniversários de Consagração
              {monthConsagracao.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{monthConsagracao.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {monthConsagracao.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum aniversário de consagração este mês</p>
            ) : (
              <ScrollArea className="max-h-52">
                <div className="space-y-2 pr-2">
                  {monthConsagracao.map(u => {
                    const isToday = todayConsagracao.some(c => c.id === u.id);
                    const years = formatAnniversaryYears(u.community_entry_date);
                    return (
                      <div key={u.id} className={`flex items-center gap-2 p-2 rounded-lg ${isToday ? 'bg-violet-50 dark:bg-violet-950/30' : 'hover:bg-muted/40'}`}>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">{getInitials(u.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm flex-1 truncate">{u.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatBirthday(u.community_entry_date)}
                          {years ? ` (${years}a)` : ''}
                        </span>
                        {isToday && <span className="text-xs">✨</span>}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-0 shadow-md" data-testid="recent-activity-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            {t('recentActivity')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            {stats?.recent_activity?.length > 0 ? (
              <div className="space-y-4">
                {stats.recent_activity.map((log, index) => (
                  <div key={log.id || index}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        <span className="text-primary">{log.user_name}</span>
                        {' '}{formatAction(log.action)}{' '}
                        {formatResourceType(log.resource_type)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(log.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Activity className="w-12 h-12 mb-2 opacity-50" />
                <p>Nenhuma atividade recente</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
