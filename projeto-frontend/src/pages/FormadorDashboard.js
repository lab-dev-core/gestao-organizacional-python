import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Users, AlertTriangle, CalendarClock, CheckCircle2, Clock,
  MapPin, Calendar, ChevronRight, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const FormadorDashboard = () => {
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [daysThreshold, setDaysThreshold] = useState(30);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `${API_URL}/acompanhamentos/formador-overview?days_threshold=${daysThreshold}`,
        { headers: getAuthHeaders() }
      );
      setData(res.data);
    } catch (err) {
      console.error('Error fetching formador overview:', err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, daysThreshold]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const getDaysSinceLabel = (days) => {
    if (days === null || days === undefined) return { text: 'Nunca realizado', color: 'text-red-600 dark:text-red-400' };
    if (days === 0) return { text: 'Hoje', color: 'text-green-600 dark:text-green-400' };
    if (days === 1) return { text: 'Ontem', color: 'text-green-600 dark:text-green-400' };
    if (days <= 7) return { text: `${days} dias atrás`, color: 'text-green-600 dark:text-green-400' };
    if (days <= 14) return { text: `${days} dias atrás`, color: 'text-yellow-600 dark:text-yellow-400' };
    if (days <= 30) return { text: `${days} dias atrás`, color: 'text-orange-600 dark:text-orange-400' };
    return { text: `${days} dias atrás`, color: 'text-red-600 dark:text-red-400' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const formandos = data?.formandos || [];
  const attention = data?.attention || [];
  const upcoming = data?.upcoming || [];
  const scheduledToday = data?.scheduled_today || [];

  return (
    <div className="space-y-6" data-testid="formador-dashboard-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel do Formador</h1>
          <p className="text-muted-foreground mt-1">
            Visão geral dos seus formandos e acompanhamentos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(daysThreshold)} onValueChange={(v) => setDaysThreshold(Number(v))}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">Atenção: +15 dias</SelectItem>
              <SelectItem value="30">Atenção: +30 dias</SelectItem>
              <SelectItem value="45">Atenção: +45 dias</SelectItem>
              <SelectItem value="60">Atenção: +60 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchOverview} title="Atualizar">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Formandos</p>
                <p className="text-3xl font-bold mt-1">{formandos.length}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={`border-0 shadow-md ${attention.length > 0 ? 'ring-2 ring-red-300 dark:ring-red-700' : ''}`}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Precisam de Atenção</p>
                <p className="text-3xl font-bold mt-1 text-red-600 dark:text-red-400">{attention.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">sem acomp. há +{daysThreshold} dias</p>
              </div>
              <div className="p-2.5 rounded-xl bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Agendados Hoje</p>
                <p className="text-3xl font-bold mt-1 text-blue-600 dark:text-blue-400">{scheduledToday.length}</p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Próximos 7 Dias</p>
                <p className="text-3xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{upcoming.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">acompanhamentos agendados</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <CalendarClock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formandos List */}
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              Meus Formandos
              <Badge variant="secondary" className="ml-auto">{formandos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[420px]">
              {formandos.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground px-6">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <p>Nenhum formando atribuído</p>
                  <p className="text-xs mt-1">Peça ao administrador para vincular formandos a você</p>
                </div>
              ) : (
                <div className="divide-y">
                  {formandos.map(f => {
                    const dayInfo = getDaysSinceLabel(f.days_since_last);
                    return (
                      <div
                        key={f.id}
                        className={`flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors ${f.needs_attention ? 'bg-red-50/60 dark:bg-red-950/20' : ''}`}
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback className={`text-sm ${f.needs_attention ? 'bg-red-100 text-red-700 dark:bg-red-900/50' : 'bg-primary/10 text-primary'}`}>
                            {getInitials(f.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{f.full_name}</p>
                            {f.needs_attention && (
                              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                            )}
                          </div>
                          {f.stage_name && (
                            <p className="text-xs text-muted-foreground">{f.stage_name}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-medium ${dayInfo.color}`}>{dayInfo.text}</p>
                          {f.last_acompanhamento_date && (
                            <p className="text-xs text-muted-foreground">{formatDate(f.last_acompanhamento_date)}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-7 w-7"
                          onClick={() => navigate('/acompanhamentos')}
                          title="Ver acompanhamentos"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right column: Agendados Hoje + Próximos */}
        <div className="space-y-4">
          {/* Agendados Hoje */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Agendados para Hoje
                {scheduledToday.length > 0 && (
                  <Badge className="ml-auto bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {scheduledToday.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scheduledToday.length === 0 ? (
                <div className="py-4 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-1 text-green-400 opacity-60" />
                  <p className="text-xs text-muted-foreground">Nenhum agendado para hoje</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {scheduledToday.map(ac => (
                    <div key={ac.id} className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 space-y-1">
                      <p className="text-sm font-medium">{ac.user_name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ac.time || '—'}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ac.location}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Próximos 7 dias */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-emerald-500" />
                Próximos 7 Dias
                {upcoming.length > 0 && (
                  <Badge className="ml-auto bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {upcoming.length}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhum agendado nos próximos 7 dias</p>
              ) : (
                <ScrollArea className="max-h-52">
                  <div className="space-y-2 pr-1">
                    {upcoming.map(ac => (
                      <div key={ac.id} className="p-2.5 rounded-lg bg-muted/50 space-y-1">
                        <p className="text-sm font-medium">{ac.user_name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(ac.date)}</span>
                          {ac.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ac.time}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Atenção necessária — mini lista */}
          {attention.length > 0 && (
            <Card className="border-0 shadow-md ring-1 ring-red-200 dark:ring-red-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  Atenção Necessária
                  <Badge className="ml-auto bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    {attention.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-44">
                  <div className="space-y-2 pr-1">
                    {attention.map(f => (
                      <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/30">
                        <Avatar className="h-7 w-7 shrink-0">
                          <AvatarFallback className="text-xs bg-red-100 text-red-700 dark:bg-red-900/50">
                            {getInitials(f.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{f.full_name}</p>
                          <p className="text-xs text-red-500">
                            {f.days_since_last !== null && f.days_since_last !== undefined
                              ? `${f.days_since_last} dias sem acompanhamento`
                              : 'Nunca acompanhado'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 text-xs"
                  onClick={() => navigate('/acompanhamentos')}
                >
                  Gerenciar Acompanhamentos
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormadorDashboard;
