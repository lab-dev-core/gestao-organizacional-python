import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { ScrollArea } from '../components/ui/scroll-area';
import { Plus, Search, Pencil, Trash2, Users, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const UsersPage = () => {
  const { getAuthHeaders, isAdmin } = useAuth();
  const { t } = useLanguage();
  
  const [users, setUsers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [functions, setFunctions] = useState([]);
  const [stages, setStages] = useState([]);
  const [formadores, setFormadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    birth_date: '',
    phone: '',
    cpf: '',
    role: 'user',
    status: 'active',
    location_id: '',
    function_id: '',
    formative_stage_id: '',
    formador_id: '',
    address: {
      cep: '',
      street: '',
      number: '',
      complement: '',
      neighborhood: '',
      city: '',
      state: ''
    }
  });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [usersRes, locationsRes, functionsRes, stagesRes, formadoresRes] = await Promise.all([
        axios.get(`${API_URL}/users`, { headers, params: { limit: 100 } }),
        axios.get(`${API_URL}/locations`, { headers }),
        axios.get(`${API_URL}/functions`, { headers }),
        axios.get(`${API_URL}/formative-stages`, { headers }),
        axios.get(`${API_URL}/users/formadores`, { headers })
      ]);
      
      setUsers(usersRes.data);
      setLocations(locationsRes.data);
      setFunctions(functionsRes.data);
      setStages(stagesRes.data);
      setFormadores(formadoresRes.data);
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

  const resetForm = () => {
    setFormData({
      full_name: '',
      email: '',
      password: '',
      birth_date: '',
      phone: '',
      cpf: '',
      role: 'user',
      status: 'active',
      location_id: '',
      function_id: '',
      formative_stage_id: '',
      formador_id: '',
      address: { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
    });
    setEditingUser(null);
    setShowPassword(false);
  };

  const handleOpenDialog = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        ...user,
        password: '',
        address: user.address || { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
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
      const payload = { ...formData };
      
      // Remove empty password on edit
      if (editingUser && !payload.password) {
        delete payload.password;
      }
      
      // Clean empty values
      Object.keys(payload).forEach(key => {
        if (payload[key] === '' || payload[key] === 'none') {
          delete payload[key];
        }
      });

      if (editingUser) {
        await axios.put(`${API_URL}/users/${editingUser.id}`, payload, { headers });
        toast.success(t('userUpdated'));
      } else {
        await axios.post(`${API_URL}/users`, payload, { headers });
        toast.success(t('userCreated'));
      }
      
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const handleDelete = async (userId) => {
    try {
      const headers = getAuthHeaders();
      await axios.delete(`${API_URL}/users/${userId}`, { headers });
      toast.success(t('userDeleted'));
      fetchData();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (role) => {
    const variants = {
      admin: 'destructive',
      formador: 'default',
      user: 'secondary'
    };
    const labels = { admin: t('admin'), formador: t('formadorRole'), user: t('user') };
    return <Badge variant={variants[role]}>{labels[role]}</Badge>;
  };

  const getStatusBadge = (status) => {
    return status === 'active' 
      ? <Badge variant="outline" className="border-green-500 text-green-600">{t('active')}</Badge>
      : <Badge variant="outline" className="border-red-500 text-red-600">{t('inactive')}</Badge>;
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
                         user.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('users')}</h1>
          <p className="text-muted-foreground mt-1">{users.length} {t('users').toLowerCase()}</p>
        </div>
        
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()} data-testid="new-user-btn">
                <Plus className="w-4 h-4 mr-2" />
                {t('newUser')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>{editingUser ? t('editUser') : t('newUser')}</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('fullName')} *</Label>
                      <Input
                        value={formData.full_name}
                        onChange={(e) => handleChange('full_name', e.target.value)}
                        required
                        data-testid="user-name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('email')} *</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        required
                        data-testid="user-email-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('password')} {!editingUser && '*'}</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          value={formData.password}
                          onChange={(e) => handleChange('password', e.target.value)}
                          required={!editingUser}
                          placeholder={editingUser ? 'Deixe em branco para manter' : ''}
                          data-testid="user-password-input"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('birthDate')}</Label>
                      <Input
                        type="date"
                        value={formData.birth_date}
                        onChange={(e) => handleChange('birth_date', e.target.value)}
                        data-testid="user-birthdate-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('phone')}</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        placeholder="(11) 99999-9999"
                        data-testid="user-phone-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('cpf')}</Label>
                      <Input
                        value={formData.cpf}
                        onChange={(e) => handleChange('cpf', e.target.value)}
                        placeholder="000.000.000-00"
                        data-testid="user-cpf-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('role')} *</Label>
                      <Select value={formData.role} onValueChange={(v) => handleChange('role', v)}>
                        <SelectTrigger data-testid="user-role-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">{t('user')}</SelectItem>
                          <SelectItem value="formador">{t('formadorRole')}</SelectItem>
                          <SelectItem value="admin">{t('admin')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('status')}</Label>
                      <Select value={formData.status} onValueChange={(v) => handleChange('status', v)}>
                        <SelectTrigger data-testid="user-status-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">{t('active')}</SelectItem>
                          <SelectItem value="inactive">{t('inactive')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('location')}</Label>
                      <Select value={formData.location_id || 'none'} onValueChange={(v) => handleChange('location_id', v === 'none' ? '' : v)}>
                        <SelectTrigger data-testid="user-location-select">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {locations.map(loc => (
                            <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('function')}</Label>
                      <Select value={formData.function_id || 'none'} onValueChange={(v) => handleChange('function_id', v === 'none' ? '' : v)}>
                        <SelectTrigger data-testid="user-function-select">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {functions.map(func => (
                            <SelectItem key={func.id} value={func.id}>{func.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('formativeStage')}</Label>
                      <Select value={formData.formative_stage_id || 'none'} onValueChange={(v) => handleChange('formative_stage_id', v === 'none' ? '' : v)}>
                        <SelectTrigger data-testid="user-stage-select">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {stages.map(stage => (
                            <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('formador')}</Label>
                      <Select value={formData.formador_id || 'none'} onValueChange={(v) => handleChange('formador_id', v === 'none' ? '' : v)}>
                        <SelectTrigger data-testid="user-formador-select">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {formadores.map(f => (
                            <SelectItem key={f.id} value={f.id}>{f.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Address Section */}
                  <div className="border-t pt-4 mt-4">
                    <h3 className="font-semibold mb-4">{t('address')}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>{t('cep')}</Label>
                        <Input
                          value={formData.address?.cep || ''}
                          onChange={(e) => handleChange('address.cep', e.target.value)}
                          placeholder="00000-000"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
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
                        <Label>{t('complement')}</Label>
                        <Input
                          value={formData.address?.complement || ''}
                          onChange={(e) => handleChange('address.complement', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('neighborhood')}</Label>
                        <Input
                          value={formData.address?.neighborhood || ''}
                          onChange={(e) => handleChange('address.neighborhood', e.target.value)}
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

                  <DialogFooter className="pt-4">
                    <DialogClose asChild>
                      <Button type="button" variant="outline">{t('cancel')}</Button>
                    </DialogClose>
                    <Button type="submit" data-testid="user-submit-btn">{t('save')}</Button>
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
                data-testid="users-search-input"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="users-role-filter">
                <SelectValue placeholder={t('role')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('all')}</SelectItem>
                <SelectItem value="admin">{t('admin')}</SelectItem>
                <SelectItem value="formador">{t('formadorRole')}</SelectItem>
                <SelectItem value="user">{t('user')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="users-status-filter">
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

      {/* Users Table */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('user')}</TableHead>
                  <TableHead>{t('email')}</TableHead>
                  <TableHead>{t('role')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('location')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Nenhum usuário encontrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => (
                    <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
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
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getStatusBadge(user.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {locations.find(l => l.id === user.location_id)?.name || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isAdmin && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenDialog(user)}
                                data-testid={`edit-user-${user.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`delete-user-${user.id}`}>
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
                                    <AlertDialogAction onClick={() => handleDelete(user.id)}>
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

export default UsersPage;
