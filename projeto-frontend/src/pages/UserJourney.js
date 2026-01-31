import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { JourneyTimeline } from '../components/ui/journey-timeline';
import {
  Search,
  Users,
  TrendingUp,
  GraduationCap,
  Plus,
  Eye,
  Calendar,
  User,
  ArrowRight,
  BarChart3
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const UserJourneyPage = () => {
  const { getAuthHeaders, isAdmin } = useAuth();
  const { t } = useLanguage();

  const [users, setUsers] = useState([]);
  const [stages, setStages] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');

  // Modal de visualização de jornada
  const [selectedUser, setSelectedUser] = useState(null);
  const [userJourney, setUserJourney] = useState([]);
  const [journeyDialogOpen, setJourneyDialogOpen] = useState(false);
  const [loadingJourney, setLoadingJourney] = useState(false);

  // Modal de registrar transição
  const [transitionDialogOpen, setTransitionDialogOpen] = useState(false);
  const [transitionData, setTransitionData] = useState({
    user_id: '',
    to_stage_id: '',
    notes: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [usersRes, stagesRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/users`, { headers, params: { limit: 100 } }),
        axios.get(`${API_URL}/formative-stages`, { headers }),
        axios.get(`${API_URL}/user-journey/stats/by-stage`, { headers })
      ]);

      setUsers(usersRes.data);
      setStages(stagesRes.data.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setStats(statsRes.data);
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

  const fetchUserJourney = async (user) => {
    setSelectedUser(user);
    setLoadingJourney(true);
    setJourneyDialogOpen(true);

    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API_URL}/user-journey/user/${user.id}`, { headers });
      setUserJourney(response.data);
    } catch (error) {
      console.error('Error fetching journey:', error);
      toast.error(t('errorOccurred'));
    } finally {
      setLoadingJourney(false);
    }
  };

  const handleOpenTransitionDialog = (user = null) => {
    setTransitionData({
      user_id: user?.id || '',
      to_stage_id: '',
      notes: ''
    });
    setTransitionDialogOpen(true);
  };

  const handleCreateTransition = async (e) => {
    e.preventDefault();
    try {
      const headers = getAuthHeaders();
      await axios.post(
        `${API_URL}/user-journey/user/${transitionData.user_id}`,
        {
          to_stage_id: transitionData.to_stage_id,
          notes: transitionData.notes || null
        },
        { headers }
      );

      toast.success(t('journeyTransitionCreated'));
      setTransitionDialogOpen(false);
      fetchData();

      // Atualizar jornada se o dialog estiver aberto
      if (journeyDialogOpen && selectedUser?.id === transitionData.user_id) {
        fetchUserJourney(selectedUser);
      }
    } catch (error) {
      console.error('Error creating transition:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStageName = (stageId) => {
    const stage = stages.find(s => s.id === stageId);
    return stage?.name || '-';
  };

  const getStageProgress = (stageId) => {
    if (!stageId || stages.length === 0) return 0;
    const stageIndex = stages.findIndex(s => s.id === stageId);
    if (stageIndex === -1) return 0;
    return Math.round(((stageIndex + 1) / stages.length) * 100);
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === 'all' ||
      (stageFilter === 'none' ? !user.formative_stage_id : user.formative_stage_id === stageFilter);
    return matchesSearch && matchesStage;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="user-journey-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('userJourney')}</h1>
          <p className="text-muted-foreground mt-1">{t('userJourneyDescription')}</p>
        </div>

        {isAdmin && (
          <Button onClick={() => handleOpenTransitionDialog()} data-testid="new-transition-btn">
            <Plus className="w-4 h-4 mr-2" />
            {t('newTransition')}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <GraduationCap className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('totalStages')}</p>
                  <p className="text-2xl font-bold">{stats.total_stages}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Users className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('usersInJourney')}</p>
                  <p className="text-2xl font-bold">
                    {users.length - stats.users_without_stage}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <User className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('usersWithoutStage')}</p>
                  <p className="text-2xl font-bold">{stats.users_without_stage}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('completionRate')}</p>
                  <p className="text-2xl font-bold">
                    {users.length > 0
                      ? Math.round(((users.length - stats.users_without_stage) / users.length) * 100)
                      : 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            {t('users')}
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('overview')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
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
                    data-testid="journey-search-input"
                  />
                </div>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                  <SelectTrigger className="w-full sm:w-48" data-testid="journey-stage-filter">
                    <SelectValue placeholder={t('formativeStage')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all')}</SelectItem>
                    <SelectItem value="none">{t('withoutStage')}</SelectItem>
                    {stages.map(stage => (
                      <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('user')}</TableHead>
                      <TableHead>{t('currentStage')}</TableHead>
                      <TableHead>{t('progress')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>{t('noUsersFound')}</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map(user => (
                        <TableRow key={user.id} data-testid={`journey-row-${user.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={user.photo_url ? `${process.env.REACT_APP_BACKEND_URL}${user.photo_url}` : undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(user.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <span className="font-medium">{user.full_name}</span>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {user.formative_stage_id ? (
                              <Badge variant="outline">{getStageName(user.formative_stage_id)}</Badge>
                            ) : (
                              <Badge variant="secondary">{t('notStarted')}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 min-w-[150px]">
                              <Progress value={getStageProgress(user.formative_stage_id)} className="h-2" />
                              <span className="text-sm text-muted-foreground">
                                {getStageProgress(user.formative_stage_id)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => fetchUserJourney(user)}
                                data-testid={`view-journey-${user.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenTransitionDialog(user)}
                                  data-testid={`add-transition-${user.id}`}
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                              )}
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
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          {/* Distribution by Stage */}
          <Card>
            <CardHeader>
              <CardTitle>{t('distributionByStage')}</CardTitle>
              <CardDescription>{t('distributionByStageDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.stages.map((stageStat, index) => (
                  <div key={stageStat.stage_id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <span className="font-medium">{stageStat.stage_name}</span>
                        {stageStat.estimated_duration && (
                          <span className="text-xs text-muted-foreground">
                            ({stageStat.estimated_duration})
                          </span>
                        )}
                      </div>
                      <Badge variant="secondary">{stageStat.user_count} {t('users').toLowerCase()}</Badge>
                    </div>
                    <Progress
                      value={users.length > 0 ? (stageStat.user_count / users.length) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                ))}

                {stats?.users_without_stage > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground">
                          -
                        </div>
                        <span className="font-medium text-muted-foreground">{t('withoutStage')}</span>
                      </div>
                      <Badge variant="outline">{stats.users_without_stage} {t('users').toLowerCase()}</Badge>
                    </div>
                    <Progress
                      value={users.length > 0 ? (stats.users_without_stage / users.length) * 100 : 0}
                      className="h-2 bg-muted"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Visualização da Jornada */}
      <Dialog open={journeyDialogOpen} onOpenChange={setJourneyDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedUser && (
                <>
                  <Avatar>
                    <AvatarImage src={selectedUser.photo_url ? `${process.env.REACT_APP_BACKEND_URL}${selectedUser.photo_url}` : undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(selectedUser.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <span>{t('journeyOf')} {selectedUser.full_name}</span>
                    <p className="text-sm font-normal text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-4">
            {loadingJourney ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Timeline Visual */}
                <JourneyTimeline
                  stages={stages}
                  journeyRecords={userJourney}
                  currentStageId={selectedUser?.formative_stage_id}
                />

                {/* Histórico Detalhado */}
                {userJourney.length > 0 && (
                  <div className="pt-6 border-t">
                    <h4 className="font-medium mb-4">{t('transitionHistory')}</h4>
                    <div className="space-y-3">
                      {userJourney.map((record, index) => (
                        <Card key={record.id} className="bg-muted/50">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <ArrowRight className="w-4 h-4 text-primary" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {record.from_stage_name ? (
                                    <>
                                      <Badge variant="outline">{record.from_stage_name}</Badge>
                                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                    </>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">{t('startedIn')}</span>
                                  )}
                                  <Badge>{record.to_stage_name}</Badge>
                                </div>
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(record.transition_date)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {record.changed_by_name}
                                  </span>
                                </div>
                                {record.notes && (
                                  <p className="mt-2 text-sm text-muted-foreground italic">
                                    "{record.notes}"
                                  </p>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {userJourney.length === 0 && !loadingJourney && (
                  <div className="text-center py-8 text-muted-foreground">
                    <GraduationCap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{t('noJourneyRecords')}</p>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('close')}</Button>
            </DialogClose>
            {isAdmin && selectedUser && (
              <Button onClick={() => handleOpenTransitionDialog(selectedUser)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('addTransition')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Nova Transição */}
      <Dialog open={transitionDialogOpen} onOpenChange={setTransitionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('newTransition')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTransition} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('user')} *</Label>
              <Select
                value={transitionData.user_id}
                onValueChange={(v) => setTransitionData(prev => ({ ...prev, user_id: v }))}
              >
                <SelectTrigger data-testid="transition-user-select">
                  <SelectValue placeholder={t('selectUser')} />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} - {getStageName(user.formative_stage_id) || t('withoutStage')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('newStage')} *</Label>
              <Select
                value={transitionData.to_stage_id}
                onValueChange={(v) => setTransitionData(prev => ({ ...prev, to_stage_id: v }))}
              >
                <SelectTrigger data-testid="transition-stage-select">
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
              <Label>{t('notes')}</Label>
              <Textarea
                value={transitionData.notes}
                onChange={(e) => setTransitionData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('transitionNotesPlaceholder')}
                rows={3}
                data-testid="transition-notes-input"
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">{t('cancel')}</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!transitionData.user_id || !transitionData.to_stage_id}
                data-testid="transition-submit-btn"
              >
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserJourneyPage;
