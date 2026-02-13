import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ScrollArea } from '../components/ui/scroll-area';
import { Plus, Search, Trash2, FileText, ExternalLink, Award, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const CertificatesPage = () => {
  const { user, getAuthHeaders, isAdmin, isFormador } = useAuth();
  const { t } = useLanguage();

  const [certificates, setCertificates] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUserId, setFilterUserId] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    user_id: '',
    issue_date: '',
    issuing_institution: '',
    file: null
  });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const params = {};
      if (filterUserId && filterUserId !== 'all') {
        params.user_id = filterUserId;
      }
      const [certsRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/certificates`, { headers, params }),
        (isAdmin || isFormador)
          ? axios.get(`${API_URL}/users`, { headers, params: { limit: 100 } })
          : Promise.resolve({ data: [] })
      ]);

      setCertificates(certsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      toast.error(t('errorOccurred'));
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, t, isAdmin, isFormador, filterUserId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      title: '', description: '', user_id: user?.id || '',
      issue_date: '', issuing_institution: '', file: null
    });
  };

  const handleOpenDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.file) {
      toast.error('Selecione um arquivo');
      return;
    }

    setSubmitting(true);
    try {
      const headers = getAuthHeaders();
      const data = new FormData();
      data.append('title', formData.title);
      data.append('user_id', formData.user_id || user.id);
      if (formData.description) data.append('description', formData.description);
      if (formData.issue_date) data.append('issue_date', formData.issue_date);
      if (formData.issuing_institution) data.append('issuing_institution', formData.issuing_institution);
      data.append('file', formData.file);

      await axios.post(`${API_URL}/certificates`, data, { headers });
      toast.success(t('certificateCreated'));
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating certificate:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (certId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/certificates/${certId}`, { headers });
      toast.success(t('certificateDeleted'));
      fetchData();
    } catch (error) {
      console.error('Error deleting certificate:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const getUserName = (userId) => {
    if (userId === user?.id) return user.full_name;
    const u = users.find(u => u.id === userId);
    return u?.full_name || userId;
  };

  const filteredCertificates = certificates.filter(cert => {
    const matchesSearch = cert.title?.toLowerCase().includes(search.toLowerCase()) ||
                         cert.issuing_institution?.toLowerCase().includes(search.toLowerCase());
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
    <div className="space-y-6" data-testid="certificates-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('certificates')}</h1>
          <p className="text-muted-foreground mt-1">{t('certificatesDescription')}</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenDialog} data-testid="new-certificate-btn">
              <Plus className="w-4 h-4 mr-2" />
              {t('newCertificate')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('uploadCertificate')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>{t('certificateTitle')} *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                  placeholder="Ex: Certificado de Conclusão - Curso de..."
                  data-testid="cert-title-input"
                />
              </div>

              <div className="space-y-2">
                <Label>{t('description')}</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrição do certificado (opcional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('issuingInstitution')}</Label>
                  <Input
                    value={formData.issuing_institution}
                    onChange={(e) => setFormData(prev => ({ ...prev, issuing_institution: e.target.value }))}
                    placeholder="Ex: Senac, Coursera..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('issueDate')}</Label>
                  <Input
                    type="date"
                    value={formData.issue_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* User selector - only for admin/formador */}
              {(isAdmin || isFormador) && (
                <div className="space-y-2">
                  <Label>{t('user')}</Label>
                  <Select
                    value={formData.user_id || user?.id || 'none'}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, user_id: v === 'none' ? '' : v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectUser')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={user?.id}>{user?.full_name} (Eu)</SelectItem>
                      {users.filter(u => u.id !== user?.id).map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t('selectFile')} *</Label>
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                  onChange={(e) => setFormData(prev => ({ ...prev, file: e.target.files[0] || null }))}
                  data-testid="cert-file-input"
                />
                <p className="text-xs text-muted-foreground">
                  {t('allowedFormats')}: PDF, DOC, DOCX, JPG, PNG
                </p>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">{t('cancel')}</Button>
                </DialogClose>
                <Button type="submit" disabled={submitting} data-testid="cert-submit-btn">
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {t('save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                data-testid="certs-search-input"
              />
            </div>
            {(isAdmin || isFormador) && (
              <Select value={filterUserId} onValueChange={setFilterUserId}>
                <SelectTrigger className="w-full sm:w-56" data-testid="certs-user-filter">
                  <SelectValue placeholder={t('filterByUser')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('all')}</SelectItem>
                  {users.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Certificates Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('certificateTitle')}</TableHead>
                  <TableHead>{t('issuingInstitution')}</TableHead>
                  <TableHead>{t('issueDate')}</TableHead>
                  {(isAdmin || isFormador) && <TableHead>{t('user')}</TableHead>}
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCertificates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin || isFormador ? 5 : 4} className="text-center py-8 text-muted-foreground">
                      <Award className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>{t('noCertificatesFound')}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCertificates.map(cert => (
                    <TableRow key={cert.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <div>
                            <span className="font-medium">{cert.title}</span>
                            {cert.description && (
                              <p className="text-xs text-muted-foreground">{cert.description}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cert.issuing_institution || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cert.issue_date ? new Date(cert.issue_date).toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      {(isAdmin || isFormador) && (
                        <TableCell className="text-muted-foreground">
                          {getUserName(cert.user_id)}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {cert.file_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(`${process.env.REACT_APP_BACKEND_URL}${cert.file_url}`, '_blank')}
                              title={t('viewFile')}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          )}
                          {(isAdmin || cert.user_id === user?.id) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="w-4 h-4 text-destructive" />
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
                                  <AlertDialogAction onClick={() => handleDelete(cert.id)}>
                                    {t('delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
    </div>
  );
};

export default CertificatesPage;
