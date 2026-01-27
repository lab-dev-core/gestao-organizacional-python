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
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ScrollArea } from '../components/ui/scroll-area';
import { Plus, Search, Pencil, Trash2, FileText, Upload, Download, Eye, Loader2, FileType, ChevronLeft, FolderOpen, GraduationCap, Lock } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const DocumentsPage = () => {
  const { getAuthHeaders, isAdmin, isFormador, user } = useAuth();
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  
  const [documents, setDocuments] = useState([]);
  const [stages, setStages] = useState([]);
  const [selectedStage, setSelectedStage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
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
      const [docsRes, stagesRes] = await Promise.all([
        axios.get(`${API_URL}/documents`, { headers }),
        axios.get(`${API_URL}/formative-stages`, { headers })
      ]);
      
      setDocuments(docsRes.data);
      setStages(stagesRes.data.sort((a, b) => a.order - b.order));
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
      formative_stage_id: selectedStage?.id || '',
      is_public: false
    });
    setEditingDoc(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleOpenDialog = (doc = null) => {
    if (doc) {
      setEditingDoc(doc);
      setFormData({
        title: doc.title,
        description: doc.description || '',
        category: doc.category || '',
        formative_stage_id: doc.formative_stage_id || selectedStage?.id || '',
        is_public: doc.is_public || false
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
      const allowed = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'];
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
    
    if (!editingDoc && !selectedFile) {
      toast.error(t('selectFile'));
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

      if (editingDoc) {
        await axios.put(`${API_URL}/documents/${editingDoc.id}`, {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          is_public: formData.is_public,
          permissions: permissions,
          formative_stage_id: formData.formative_stage_id
        }, { headers });
        toast.success(t('documentUpdated'));
      } else {
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('title', formData.title);
        fd.append('description', formData.description);
        fd.append('category', formData.category);
        fd.append('is_public', formData.is_public);
        fd.append('permissions', JSON.stringify(permissions));
        fd.append('formative_stage_id', formData.formative_stage_id);

        await axios.post(`${API_URL}/documents`, fd, {
          headers: { ...headers, 'Content-Type': 'multipart/form-data' }
        });
        toast.success(t('documentCreated'));
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/documents/${docId}`, { headers });
      toast.success(t('documentDeleted'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const handleDownload = async (doc) => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API_URL}/documents/${doc.id}/download`, {
        headers,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error(t('errorOccurred'));
    }
  };

  const getFileIcon = (type) => {
    const icons = {
      pdf: 'text-red-500',
      doc: 'text-blue-500',
      docx: 'text-blue-500',
      xls: 'text-green-500',
      xlsx: 'text-green-500',
      ppt: 'text-orange-500',
      pptx: 'text-orange-500',
      txt: 'text-gray-500'
    };
    return icons[type] || 'text-gray-500';
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Get document count for each stage
  const getStageDocCount = (stageId) => {
    return documents.filter(doc => doc.formative_stage_id === stageId).length;
  };

  // Get documents without stage (general/public)
  const getGeneralDocs = () => {
    return documents.filter(doc => !doc.formative_stage_id || doc.is_public);
  };

  // Get documents for selected stage
  const getStageDocuments = () => {
    if (!selectedStage) return [];
    return documents.filter(doc => 
      doc.formative_stage_id === selectedStage.id || 
      (doc.is_public && !doc.formative_stage_id)
    );
  };

  const filteredDocs = (selectedStage ? getStageDocuments() : getGeneralDocs()).filter(doc => {
    return doc.title?.toLowerCase().includes(search.toLowerCase()) ||
           doc.description?.toLowerCase().includes(search.toLowerCase());
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
      <div className="space-y-6" data-testid="documents-page">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('documents')}</h1>
          <p className="text-muted-foreground mt-1">
            Selecione uma etapa formativa para acessar os documentos
          </p>
        </div>

        {/* Stages Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stages.map((stage, index) => {
            const hasAccess = hasAccessToStage(stage.id);
            const docCount = getStageDocCount(stage.id);
            
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
                      hasAccess ? 'bg-primary/10' : 'bg-muted'
                    }`}>
                      {hasAccess ? (
                        <FolderOpen className={`w-8 h-8 ${hasAccess ? 'text-primary' : 'text-muted-foreground'}`} />
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
                      <FileText className="w-4 h-4" />
                      <span>{docCount} {docCount === 1 ? 'documento' : 'documentos'}</span>
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
                <p className="text-sm mt-2">Cadastre etapas formativas para organizar os documentos</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* General Documents Section */}
        {getGeneralDocs().length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Documentos Gerais</h2>
            <Card className="border-0 shadow-md">
              <CardContent className="p-0">
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('title')}</TableHead>
                        <TableHead>{t('category')}</TableHead>
                        <TableHead>{t('views')}</TableHead>
                        <TableHead className="text-right">{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getGeneralDocs().slice(0, 5).map(doc => (
                        <TableRow key={doc.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-muted ${getFileIcon(doc.file_type)}`}>
                                <FileType className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-medium">{doc.title}</p>
                                <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {doc.category && <Badge variant="secondary">{doc.category}</Badge>}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Eye className="w-4 h-4" />
                              {doc.views}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(doc)}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // Documents List View (inside a stage)
  return (
    <div className="space-y-6" data-testid="documents-stage-view">
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
              {filteredDocs.length} {t('documents').toLowerCase()}
              {selectedStage.estimated_duration && ` • ${selectedStage.estimated_duration}`}
            </p>
          </div>
        </div>
        
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="new-document-btn">
                <Plus className="w-4 h-4 mr-2" />
                {t('newDocument')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingDoc ? t('editDocument') : t('newDocument')}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!editingDoc && (
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
                          PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT
                        </p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                          onChange={handleFileChange}
                          className="hidden"
                          data-testid="document-file-input"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>{t('title')} *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      required
                      data-testid="document-title-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('category')}</Label>
                    <Input
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      placeholder="Ex: Manual, Apostila, Exercício"
                      data-testid="document-category-input"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t('description')}</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      data-testid="document-description-input"
                    />
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" />
                      Etapa: {selectedStage.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Este documento será acessível apenas para usuários desta etapa formativa
                    </p>
                  </div>

                  <DialogFooter className="pt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">{t('cancel')}</Button>
                    </DialogClose>
                    <Button type="submit" disabled={uploading} data-testid="document-submit-btn">
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
              data-testid="documents-search-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('title')}</TableHead>
                  <TableHead>{t('category')}</TableHead>
                  <TableHead>{t('views')}</TableHead>
                  <TableHead>{t('downloads')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum documento nesta etapa</p>
                      {canManage && (
                        <Button
                          variant="link"
                          onClick={() => handleOpenDialog()}
                          className="mt-2"
                        >
                          Adicionar primeiro documento
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDocs.map(doc => (
                    <TableRow key={doc.id} data-testid={`document-row-${doc.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg bg-muted ${getFileIcon(doc.file_type)}`}>
                            <FileType className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">{doc.title}</p>
                            <p className="text-xs text-muted-foreground">{doc.file_name} • {formatFileSize(doc.file_size)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.category && <Badge variant="secondary">{doc.category}</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Eye className="w-4 h-4" />
                          {doc.views}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Download className="w-4 h-4" />
                          {doc.downloads}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(doc)}
                            data-testid={`download-doc-${doc.id}`}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {canManage && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(doc)}
                                data-testid={`edit-doc-${doc.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`delete-doc-${doc.id}`}>
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
                                    <AlertDialogAction onClick={() => handleDelete(doc.id)}>
                                      {t('delete')}
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
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

export default DocumentsPage;
