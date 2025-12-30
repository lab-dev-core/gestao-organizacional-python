import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ScrollArea } from '../components/ui/scroll-area';
import { Plus, Search, Pencil, Trash2, Briefcase } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const FunctionsPage = () => {
  const { getAuthHeaders, isAdmin } = useAuth();
  const { t } = useLanguage();
  
  const [functions, setFunctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFunction, setEditingFunction] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    hierarchy_level: 0
  });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API_URL}/functions`, { headers });
      setFunctions(response.data);
    } catch (error) {
      console.error('Error fetching functions:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({ name: '', description: '', hierarchy_level: 0 });
    setEditingFunction(null);
  };

  const handleOpenDialog = (func = null) => {
    if (func) {
      setEditingFunction(func);
      setFormData({
        name: func.name,
        description: func.description || '',
        hierarchy_level: func.hierarchy_level || 0
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const headers = getAuthHeaders();
      const payload = {
        ...formData,
        hierarchy_level: parseInt(formData.hierarchy_level) || 0
      };

      if (editingFunction) {
        await axios.put(`${API_URL}/functions/${editingFunction.id}`, payload, { headers });
        toast.success(t('functionUpdated'));
      } else {
        await axios.post(`${API_URL}/functions`, payload, { headers });
        toast.success(t('functionCreated'));
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const handleDelete = async (funcId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/functions/${funcId}`, { headers });
      toast.success(t('functionDeleted'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const filteredFunctions = functions.filter(func =>
    func.name?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="functions-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('functions')}</h1>
          <p className="text-muted-foreground mt-1">{functions.length} {t('functions').toLowerCase()}</p>
        </div>
        
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="new-function-btn">
                <Plus className="w-4 h-4 mr-2" />
                {t('newFunction')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingFunction ? t('editFunction') : t('newFunction')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('functionName')} *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    data-testid="function-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('description')}</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    data-testid="function-description-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('hierarchyLevel')}</Label>
                  <Input
                    type="number"
                    value={formData.hierarchy_level}
                    onChange={(e) => setFormData(prev => ({ ...prev, hierarchy_level: e.target.value }))}
                    min={0}
                    data-testid="function-level-input"
                  />
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">{t('cancel')}</Button>
                  </DialogClose>
                  <Button type="submit" data-testid="function-submit-btn">{t('save')}</Button>
                </DialogFooter>
              </form>
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
              data-testid="functions-search-input"
            />
          </div>
        </CardContent>
      </Card>

      {/* Functions Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('functionName')}</TableHead>
                  <TableHead>{t('description')}</TableHead>
                  <TableHead>{t('hierarchyLevel')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFunctions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      <Briefcase className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma função encontrada</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFunctions.map(func => (
                    <TableRow key={func.id} data-testid={`function-row-${func.id}`}>
                      <TableCell className="font-medium">{func.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-md truncate">
                        {func.description || '-'}
                      </TableCell>
                      <TableCell>{func.hierarchy_level || 0}</TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(func)}
                              data-testid={`edit-function-${func.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`delete-function-${func.id}`}>
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
                                  <AlertDialogAction onClick={() => handleDelete(func.id)}>
                                    {t('delete')}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
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

export default FunctionsPage;
