import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { ScrollArea } from '../components/ui/scroll-area';
import { Plus, Search, Pencil, Trash2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const LocationsPage = () => {
  const { getAuthHeaders, isAdmin } = useAuth();
  const { t } = useLanguage();
  
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    responsible: '',
    capacity: '',
    status: 'active',
    address: { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
  });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`${API_URL}/locations`, { headers });
      setLocations(response.data);
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setFormData({
      name: '',
      responsible: '',
      capacity: '',
      status: 'active',
      address: { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
    });
    setEditingLocation(null);
  };

  const handleOpenDialog = (location = null) => {
    if (location) {
      setEditingLocation(location);
      setFormData({
        name: location.name,
        responsible: location.responsible || '',
        capacity: location.capacity?.toString() || '',
        status: location.status,
        address: location.address || { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const headers = getAuthHeaders();
      const payload = {
        ...formData,
        capacity: formData.capacity ? parseInt(formData.capacity) : null
      };

      if (editingLocation) {
        await axios.put(`${API_URL}/locations/${editingLocation.id}`, payload, { headers });
        toast.success(t('locationUpdated'));
      } else {
        await axios.post(`${API_URL}/locations`, payload, { headers });
        toast.success(t('locationCreated'));
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const handleDelete = async (locationId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/locations/${locationId}`, { headers });
      toast.success(t('locationDeleted'));
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const filteredLocations = locations.filter(loc => {
    const matchesSearch = loc.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || loc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="locations-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('locations')}</h1>
          <p className="text-muted-foreground mt-1">{locations.length} {t('locations').toLowerCase()}</p>
        </div>
        
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="new-location-btn">
                <Plus className="w-4 h-4 mr-2" />
                {t('newLocation')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingLocation ? t('editLocation') : t('newLocation')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>{t('locationName')} *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      required
                      data-testid="location-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('responsible')}</Label>
                    <Input
                      value={formData.responsible}
                      onChange={(e) => handleChange('responsible', e.target.value)}
                      data-testid="location-responsible-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('capacity')}</Label>
                    <Input
                      type="number"
                      value={formData.capacity}
                      onChange={(e) => handleChange('capacity', e.target.value)}
                      data-testid="location-capacity-input"
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>{t('status')}</Label>
                    <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                      <SelectTrigger data-testid="location-status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t('active')}</SelectItem>
                        <SelectItem value="inactive">{t('inactive')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-4">{t('address')}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>{t('cep')}</Label>
                      <Input
                        value={formData.address?.cep || ''}
                        onChange={(e) => handleChange('address.cep', e.target.value)}
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label>{t('street')}</Label>
                      <Input
                        value={formData.address?.street || ''}
                        onChange={(e) => handleChange('address.street', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('number')}</Label>
                      <Input
                        value={formData.address?.number || ''}
                        onChange={(e) => handleChange('address.number', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('city')}</Label>
                      <Input
                        value={formData.address?.city || ''}
                        onChange={(e) => handleChange('address.city', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('state')}</Label>
                      <Input
                        value={formData.address?.state || ''}
                        onChange={(e) => handleChange('address.state', e.target.value)}
                        maxLength={2}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">{t('cancel')}</Button>
                  </DialogClose>
                  <Button type="submit" data-testid="location-submit-btn">{t('save')}</Button>
                </DialogFooter>
              </form>
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
                data-testid="locations-search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="locations-status-filter">
                <SelectValue placeholder={t('status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                <SelectItem value="active">{t('active')}</SelectItem>
                <SelectItem value="inactive">{t('inactive')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Locations Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('locationName')}</TableHead>
                  <TableHead>{t('responsible')}</TableHead>
                  <TableHead>{t('capacity')}</TableHead>
                  <TableHead>{t('address')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum local encontrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLocations.map(loc => (
                    <TableRow key={loc.id} data-testid={`location-row-${loc.id}`}>
                      <TableCell className="font-medium">{loc.name}</TableCell>
                      <TableCell className="text-muted-foreground">{loc.responsible || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">{loc.capacity || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {loc.address?.city ? `${loc.address.city}, ${loc.address.state}` : '-'}
                      </TableCell>
                      <TableCell>
                        {loc.status === 'active'
                          ? <Badge variant="outline" className="border-green-500 text-green-600">{t('active')}</Badge>
                          : <Badge variant="outline" className="border-red-500 text-red-600">{t('inactive')}</Badge>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(loc)}
                              data-testid={`edit-location-${loc.id}`}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`delete-location-${loc.id}`}>
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
                                  <AlertDialogAction onClick={() => handleDelete(loc.id)}>
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

export default LocationsPage;
