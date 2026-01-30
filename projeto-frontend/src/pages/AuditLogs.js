import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Search, ClipboardList, Activity } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const AuditLogsPage = () => {
  const { getAuthHeaders } = useAuth();
  const { t } = useLanguage();
  
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const params = { limit: 100 };
      if (actionFilter !== 'all') params.action = actionFilter;
      if (resourceFilter !== 'all') params.resource_type = resourceFilter;
      
      const response = await axios.get(`${API_URL}/audit-logs`, { headers, params });
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, actionFilter, resourceFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getActionBadge = (action) => {
    const variants = {
      create: 'default',
      update: 'secondary',
      delete: 'destructive',
      login: 'outline',
      register: 'outline',
      view: 'secondary',
      download: 'secondary',
      upload: 'default'
    };
    const labels = {
      create: 'Criou',
      update: 'Atualizou',
      delete: 'Excluiu',
      login: 'Login',
      register: 'Cadastro',
      view: 'Visualizou',
      download: 'Baixou',
      upload: 'Enviou'
    };
    return <Badge variant={variants[action] || 'secondary'}>{labels[action] || action}</Badge>;
  };

  const getResourceLabel = (type) => {
    const labels = {
      user: 'Usuário',
      document: 'Documento',
      video: 'Vídeo',
      location: 'Local',
      function: 'Função',
      formative_stage: 'Etapa'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="audit-logs-page">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('auditLogs')}</h1>
        <p className="text-muted-foreground mt-1">{logs.length} registros</p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="logs-action-filter">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Atualização</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="view">Visualização</SelectItem>
                <SelectItem value="download">Download</SelectItem>
                <SelectItem value="upload">Upload</SelectItem>
              </SelectContent>
            </Select>
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="logs-resource-filter">
                <SelectValue placeholder="Recurso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                <SelectItem value="user">Usuário</SelectItem>
                <SelectItem value="document">Documento</SelectItem>
                <SelectItem value="video">Vídeo</SelectItem>
                <SelectItem value="location">Local</SelectItem>
                <SelectItem value="function">Função</SelectItem>
                <SelectItem value="formative_stage">Etapa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Recurso</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum registro encontrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.id} data-testid={`log-row-${log.id}`}>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">{log.user_name}</TableCell>
                      <TableCell>{getActionBadge(log.action)}</TableCell>
                      <TableCell>{getResourceLabel(log.resource_type)}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate">
                        {log.details ? JSON.stringify(log.details) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuditLogsPage;
