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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, Search, Pencil, Trash2, FileText, Upload, Download, Eye, Loader2, File, FileType } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const DocumentsPage = () => {
  const { getAuthHeaders, isAdmin, isFormador } = useAuth();
  const { t } = useLanguage();
  const fileInputRef = useRef(null);
  
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [locations, setLocations] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [stages, setStages] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    is_public: false,
    permissions: {
      location_ids: [],
      user_ids: [],
      function_ids: [],
      formative_stage_ids: []
    }
  });

  const canManage = isAdmin || isFormador;

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [docsRes, catsRes, locsRes, funcsRes, stagesRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/documents`, { headers }),
        axios.get(`${API_URL}/documents/categories`, { headers }),
        axios.get(`${API_URL}/locations`, { headers }),
        axios.get(`${API_URL}/functions`, { headers }),
        axios.get(`${API_URL}/formative-stages`, { headers }),
        axios.get(`${API_URL}/users`, { headers, params: { limit: 100 } })
      ]);
      
      setDocuments(docsRes.data);
      setCategories(catsRes.data);
      setLocations(locsRes.data);
      setFunctions(funcsRes.data);
      setStages(stagesRes.data);
      setUsers(usersRes.data);
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
      is_public: false,
      permissions: { location_ids: [], user_ids: [], function_ids: [], formative_stage_ids: [] }
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
        is_public: doc.is_public || false,
        permissions: doc.permissions || { location_ids: [], user_ids: [], function_ids: [], formative_stage_ids: [] }
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

      if (editingDoc) {
        await axios.put(`${API_URL}/documents/${editingDoc.id}`, {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          is_public: formData.is_public,
          permissions: formData.permissions
        }, { headers });
        toast.success(t('documentUpdated'));
      } else {
        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('title', formData.title);
        fd.append('description', formData.description);
        fd.append('category', formData.category);
        fd.append('is_public', formData.is_public);
        fd.append('permissions', JSON.stringify(formData.permissions));

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

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.title?.toLowerCase().includes(search.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="documents-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('documents')}</h1>
          <p className="text-muted-foreground mt-1">{documents.length} {t('documents').toLowerCase()}</p>
        </div>
        
        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="new-document-btn">
                <Plus className="w-4 h-4 mr-2" />
                {t('newDocument')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editingDoc ? t('editDocument') : t('newDocument')}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!editingDoc && (
                    <div className="space-y-2">
                      <Label>{t('selectFile')} *</Label>
                      <div 
                        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                          {selectedFile ? selectedFile.name : t('dragDrop')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('allowedFormats')}: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        placeholder="Ex: Formação, Manual, Regulamento"
                        data-testid="document-category-input"
                      />
                    </div>
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

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="is_public"
                      checked={formData.is_public}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))}
                      data-testid="document-public-switch"
                    />
                    <Label htmlFor="is_public">{t('public')}</Label>
                  </div>

                  {!formData.is_public && (
                    <div className="border-t pt-4">
                      <h3 className="font-semibold mb-4">{t('permissions')}</h3>
                      <Tabs defaultValue="locations">
                        <TabsList className="grid grid-cols-4 w-full">
                          <TabsTrigger value="locations">{t('locations')}</TabsTrigger>
                          <TabsTrigger value="functions">{t('functions')}</TabsTrigger>
                          <TabsTrigger value="stages">{t('formativeStages')}</TabsTrigger>
                          <TabsTrigger value="users">{t('users')}</TabsTrigger>
                        </TabsList>
                        <TabsContent value="locations" className="mt-4">
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                            {locations.map(loc => (
                              <label key={loc.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.location_ids.includes(loc.id)}
                                  onChange={(e) => {
                                    const ids = e.target.checked
                                      ? [...formData.permissions.location_ids, loc.id]
                                      : formData.permissions.location_ids.filter(id => id !== loc.id);
                                    setFormData(prev => ({
                                      ...prev,
                                      permissions: { ...prev.permissions, location_ids: ids }
                                    }));
                                  }}
                                />
                                {loc.name}
                              </label>
                            ))}
                          </div>
                        </TabsContent>
                        <TabsContent value="functions" className="mt-4">
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                            {functions.map(func => (
                              <label key={func.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.function_ids.includes(func.id)}
                                  onChange={(e) => {
                                    const ids = e.target.checked
                                      ? [...formData.permissions.function_ids, func.id]
                                      : formData.permissions.function_ids.filter(id => id !== func.id);
                                    setFormData(prev => ({
                                      ...prev,
                                      permissions: { ...prev.permissions, function_ids: ids }
                                    }));
                                  }}
                                />
                                {func.name}
                              </label>
                            ))}
                          </div>
                        </TabsContent>
                        <TabsContent value="stages" className="mt-4">
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                            {stages.map(stage => (
                              <label key={stage.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.formative_stage_ids.includes(stage.id)}
                                  onChange={(e) => {
                                    const ids = e.target.checked
                                      ? [...formData.permissions.formative_stage_ids, stage.id]
                                      : formData.permissions.formative_stage_ids.filter(id => id !== stage.id);
                                    setFormData(prev => ({
                                      ...prev,
                                      permissions: { ...prev.permissions, formative_stage_ids: ids }
                                    }));
                                  }}
                                />
                                {stage.name}
                              </label>
                            ))}
                          </div>
                        </TabsContent>
                        <TabsContent value="users" className="mt-4">
                          <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                            {users.map(user => (
                              <label key={user.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={formData.permissions.user_ids.includes(user.id)}
                                  onChange={(e) => {
                                    const ids = e.target.checked
                                      ? [...formData.permissions.user_ids, user.id]
                                      : formData.permissions.user_ids.filter(id => id !== user.id);
                                    setFormData(prev => ({
                                      ...prev,
                                      permissions: { ...prev.permissions, user_ids: ids }
                                    }));
                                  }}
                                />
                                {user.full_name}
                              </label>
                            ))}
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  )}

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
                data-testid="documents-search-input"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48" data-testid="documents-category-filter">
                <SelectValue placeholder={t('category')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDocs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum documento encontrado</p>
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
                      <TableCell>
                        {doc.is_public 
                          ? <Badge variant="outline" className="border-green-500 text-green-600">{t('public')}</Badge>
                          : <Badge variant="outline">Restrito</Badge>
                        }
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
