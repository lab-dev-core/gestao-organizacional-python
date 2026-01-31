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
  Search, Users, GraduationCap, Plus, Eye, Calendar, User, ArrowRight,
  BarChart3, CheckCircle, XCircle, Clock, UserPlus, Play
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const UserJourneyPage = () => {
  const { getAuthHeaders, isAdmin } = useAuth();
  const { t } = useLanguage();

  const [users, setUsers] = useState([]);
  const [stages, setStages] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal de visualização de jornada
  const [selectedUser, setSelectedUser] = useState(null);
  const [userJourney, setUserJourney] = useState(null);
  const [journeyDialogOpen, setJourneyDialogOpen] = useState(false);
  const [loadingJourney, setLoadingJourney] = useState(false);

  // Modal de inscrição em ciclo
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollData, setEnrollData] = useState({
    user_id: '',
    cycle_id: '',
    notes: ''
  });

  // Modal de avaliação
  const [evaluateDialogOpen, setEvaluateDialogOpen] = useState(false);
  const [evaluateData, setEvaluateData] = useState({
    participation_id: '',
    action: '',
    evaluation_notes: ''
  });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [usersRes, stagesRes, cyclesRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/users`, { headers, params: { limit: 100 } }),
        axios.get(`${API_URL}/formative-stages`, { headers }),
        axios.get(`${API_URL}/stage-cycles/active`, { headers }),
        axios.get(`${API_URL}/stage-participations/stats/overview`, { headers })
      ]);

      setUsers(usersRes.data);
      setStages(stagesRes.data.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setCycles(cyclesRes.data);
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
      const response = await axios.get(`${API_URL}/stage-participations/user/${user.id}/journey`, { headers });
      setUserJourney(response.data);
    } catch (error) {
      console.error('Error fetching journey:', error);
      toast.error(t('errorOccurred'));
    } finally {
      setLoadingJourney(false);
    }
  };

  const handleOpenEnrollDialog = (user = null) => {
    setEnrollData({
      user_id: user?.id || '',
      cycle_id: '',
      notes: ''
    });
    setEnrollDialogOpen(true);
  };

  const handleEnroll = async (e) => {
    e.preventDefault();
    try {
      const headers = getAuthHeaders();
      await axios.post(`${API_URL}/stage-participations`, enrollData, { headers });

      toast.success(t('userEnrolled'));
      setEnrollDialogOpen(false);
      fetchData();

      if (journeyDialogOpen && selectedUser?.id === enrollData.user_id) {
        fetchUserJourney(selectedUser);
      }
    } catch (error) {
      console.error('Error enrolling user:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const handleEvaluate = async (participationId, action) => {
    setEvaluateData({
      participation_id: participationId,
      action: action,
      evaluation_notes: ''
    });
    setEvaluateDialogOpen(true);
  };

  const submitEvaluation = async (e) => {
    e.preventDefault();
    try {
      const headers = getAuthHeaders();
      const endpoint = evaluateData.action === 'approve' ? 'approve' : 'reprove';

      await axios.post(
        `${API_URL}/stage-participations/${evaluateData.participation_id}/${endpoint}`,
        null,
        {
          headers,
          params: { evaluation_notes: evaluateData.evaluation_notes || null }
        }
      );

      toast.success(evaluateData.action === 'approve' ? t('participantApproved') : t('participantReproved'));
      setEvaluateDialogOpen(false);

      if (journeyDialogOpen && selectedUser) {
        fetchUserJourney(selectedUser);
      }
      fetchData();
    } catch (error) {
      console.error('Error evaluating:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusBadge = (status) => {
    const config = {
      enrolled: { variant: 'secondary', icon: Clock, label: t('enrolled'), color: '' },
      in_progress: { variant: 'default', icon: Play, label: t('inProgress'), color: '' },
      approved: { variant: 'default', icon: CheckCircle, label: t('approved'), color: 'bg-green-500' },
      reproved: { variant: 'destructive', icon: XCircle, label: t('reproved'), color: '' },
      withdrawn: { variant: 'outline', icon: User, label: t('withdrawn'), color: '' },
      transferred: { variant: 'outline', icon: ArrowRight, label: t('transferred'), color: '' }
    };
    const { variant, icon: Icon, label, color } = config[status] || config.enrolled;
    return (
      <Badge variant={variant} className={`gap-1 ${color}`}>
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

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
          <Button onClick={() => handleOpenEnrollDialog()} data-testid="enroll-user-btn">
            <UserPlus className="w-4 h-4 mr-2" />
            {t('enrollUser')}
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
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('usersInJourney')}</p>
                  <p className="text-2xl font-bold">{stats.unique_users_in_journey}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <Play className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('activeCycles')}</p>
                  <p className="text-2xl font-bold">{stats.active_cycles}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('approved')}</p>
                  <p className="text-2xl font-bold">{stats.by_status?.approved || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-amber-500/10">
                  <Clock className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('inProgress')}</p>
                  <p className="text-2xl font-bold">
                    {(stats.by_status?.enrolled || 0) + (stats.by_status?.in_progress || 0)}
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
                  />
                </div>
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
                      <TableHead>{t('email')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>{t('noUsersFound')}</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map(user => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarImage src={user.photo_url ? `${process.env.REACT_APP_BACKEND_URL}${user.photo_url}` : undefined} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {getInitials(user.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{user.full_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{user.email}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => fetchUserJourney(user)}
                                title={t('viewJourney')}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEnrollDialog(user)}
                                  title={t('enrollInCycle')}
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
          <Card>
            <CardHeader>
              <CardTitle>{t('participationsByStatus')}</CardTitle>
              <CardDescription>{t('participationsByStatusDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats && Object.entries(stats.by_status || {}).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusBadge(status)}
                    </div>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
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
            ) : userJourney ? (
              <div className="space-y-6">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-primary">{userJourney.journey_progress_percent}%</p>
                      <p className="text-sm text-muted-foreground">{t('progress')}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold">{userJourney.total_stages_completed}</p>
                      <p className="text-sm text-muted-foreground">{t('stagesCompleted')}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-lg font-medium truncate">{userJourney.current_stage || '-'}</p>
                      <p className="text-sm text-muted-foreground">{t('currentStage')}</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Timeline Visual */}
                <JourneyTimeline
                  stages={stages}
                  journeyRecords={userJourney.participations?.filter(p => p.status === 'approved').map(p => ({
                    to_stage_id: p.stage_id,
                    transition_date: p.completion_date
                  })) || []}
                  currentStageId={userJourney.participations?.find(p => ['enrolled', 'in_progress'].includes(p.status))?.stage_id}
                />

                {/* Participations List */}
                {userJourney.participations?.length > 0 && (
                  <div className="pt-6 border-t">
                    <h4 className="font-medium mb-4">{t('participationHistory')}</h4>
                    <div className="space-y-3">
                      {userJourney.participations.map((participation) => (
                        <Card key={participation.id} className="bg-muted/50">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <Badge variant="outline">{participation.stage_name}</Badge>
                                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-medium">{participation.cycle_name}</span>
                                </div>
                                {getStatusBadge(participation.status)}
                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {t('enrolled')}: {formatDate(participation.enrollment_date)}
                                  </span>
                                  {participation.completion_date && (
                                    <span className="flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" />
                                      {t('completed')}: {formatDate(participation.completion_date)}
                                    </span>
                                  )}
                                </div>
                                {participation.evaluation_notes && (
                                  <p className="mt-2 text-sm text-muted-foreground italic">
                                    "{participation.evaluation_notes}"
                                  </p>
                                )}
                              </div>

                              {isAdmin && ['enrolled', 'in_progress'].includes(participation.status) && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-green-600 border-green-600 hover:bg-green-50"
                                    onClick={() => handleEvaluate(participation.id, 'approve')}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    {t('approve')}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 border-red-600 hover:bg-red-50"
                                    onClick={() => handleEvaluate(participation.id, 'reprove')}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    {t('reprove')}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {(!userJourney.participations || userJourney.participations.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    <GraduationCap className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{t('noParticipations')}</p>
                  </div>
                )}
              </div>
            ) : null}
          </ScrollArea>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('close')}</Button>
            </DialogClose>
            {isAdmin && selectedUser && (
              <Button onClick={() => handleOpenEnrollDialog(selectedUser)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('enrollInCycle')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Inscrição em Ciclo */}
      <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('enrollUser')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEnroll} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('user')} *</Label>
              <Select
                value={enrollData.user_id}
                onValueChange={(v) => setEnrollData(prev => ({ ...prev, user_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectUser')} />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('cycle')} *</Label>
              <Select
                value={enrollData.cycle_id}
                onValueChange={(v) => setEnrollData(prev => ({ ...prev, cycle_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectCycle')} />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map(cycle => (
                    <SelectItem key={cycle.id} value={cycle.id}>
                      {cycle.stage_name} - {cycle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Textarea
                value={enrollData.notes}
                onChange={(e) => setEnrollData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={t('enrollmentNotesPlaceholder')}
                rows={2}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">{t('cancel')}</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!enrollData.user_id || !enrollData.cycle_id}
              >
                {t('enroll')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de Avaliação */}
      <Dialog open={evaluateDialogOpen} onOpenChange={setEvaluateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {evaluateData.action === 'approve' ? t('approveParticipant') : t('reproveParticipant')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={submitEvaluation} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('evaluationNotes')}</Label>
              <Textarea
                value={evaluateData.evaluation_notes}
                onChange={(e) => setEvaluateData(prev => ({ ...prev, evaluation_notes: e.target.value }))}
                placeholder={t('evaluationNotesPlaceholder')}
                rows={3}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">{t('cancel')}</Button>
              </DialogClose>
              <Button
                type="submit"
                variant={evaluateData.action === 'approve' ? 'default' : 'destructive'}
              >
                {evaluateData.action === 'approve' ? t('approve') : t('reprove')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserJourneyPage;
