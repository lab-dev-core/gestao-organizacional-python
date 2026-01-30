import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Users,
  HardDrive,
  BarChart3,
  Loader2,
  ExternalLink,
  Copy,
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const PLANS = [
  { value: 'free', label: 'Free', users: 10, storage: 5 },
  { value: 'basic', label: 'Basic', users: 50, storage: 20 },
  { value: 'pro', label: 'Pro', users: 200, storage: 100 },
  { value: 'enterprise', label: 'Enterprise', users: 9999, storage: 1000 },
];

const Tenants = () => {
  const { getAuthHeaders, isSuperAdmin } = useAuth();
  const { t } = useLanguage();

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantStats, setTenantStats] = useState(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    plan: 'free',
    max_users: 10,
    max_storage_gb: 5,
    contact_email: '',
    contact_phone: '',
    owner_name: '',
    owner_email: '',
    owner_password: '',
  });

  const fetchTenants = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (planFilter) params.append('plan', planFilter);

      const response = await axios.get(`${API_URL}/tenants?${params}`, {
        headers: getAuthHeaders(),
      });
      setTenants(response.data);
    } catch (error) {
      toast.error('Erro ao carregar organizações');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, search, statusFilter, planFilter]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchTenants();
    }
  }, [fetchTenants, isSuperAdmin]);

  const handlePlanChange = (plan) => {
    const planInfo = PLANS.find((p) => p.value === plan);
    setFormData({
      ...formData,
      plan,
      max_users: planInfo?.users || 10,
      max_storage_gb: planInfo?.storage || 5,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (selectedTenant) {
        // Update
        const updateData = {
          name: formData.name,
          plan: formData.plan,
          max_users: formData.max_users,
          max_storage_gb: formData.max_storage_gb,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          status: formData.status,
        };

        await axios.put(`${API_URL}/tenants/${selectedTenant.id}`, updateData, {
          headers: getAuthHeaders(),
        });
        toast.success('Organização atualizada com sucesso');
      } else {
        // Create
        await axios.post(`${API_URL}/tenants`, formData, {
          headers: getAuthHeaders(),
        });
        toast.success('Organização criada com sucesso');
      }

      setIsDialogOpen(false);
      fetchTenants();
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erro ao salvar organização');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      plan: tenant.plan,
      max_users: tenant.max_users,
      max_storage_gb: tenant.max_storage_gb,
      contact_email: tenant.contact_email || '',
      contact_phone: tenant.contact_phone || '',
      status: tenant.status,
      owner_name: '',
      owner_email: '',
      owner_password: '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (tenant) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${tenant.name}"? Esta ação não pode ser desfeita e todos os dados serão perdidos.`)) {
      return;
    }

    try {
      await axios.delete(`${API_URL}/tenants/${tenant.id}`, {
        headers: getAuthHeaders(),
      });
      toast.success('Organização excluída com sucesso');
      fetchTenants();
    } catch (error) {
      toast.error('Erro ao excluir organização');
    }
  };

  const handleViewStats = async (tenant) => {
    try {
      const response = await axios.get(`${API_URL}/tenants/${tenant.id}/stats`, {
        headers: getAuthHeaders(),
      });
      setTenantStats(response.data);
      setSelectedTenant(tenant);
      setIsStatsDialogOpen(true);
    } catch (error) {
      toast.error('Erro ao carregar estatísticas');
    }
  };

  const resetForm = () => {
    setSelectedTenant(null);
    setFormData({
      name: '',
      slug: '',
      plan: 'free',
      max_users: 10,
      max_storage_gb: 5,
      contact_email: '',
      contact_phone: '',
      owner_name: '',
      owner_email: '',
      owner_password: '',
    });
  };

  const copyLoginUrl = (slug) => {
    const url = `${window.location.origin}/login?org=${slug}`;
    navigator.clipboard.writeText(url);
    toast.success('URL copiada para a área de transferência');
  };

  const getStatusBadge = (status) => {
    const variants = {
      active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      suspended: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    };
    const labels = {
      active: 'Ativo',
      inactive: 'Inativo',
      suspended: 'Suspenso',
    };
    return <Badge className={variants[status]}>{labels[status]}</Badge>;
  };

  const getPlanBadge = (plan) => {
    const variants = {
      free: 'bg-gray-100 text-gray-800',
      basic: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-amber-100 text-amber-800',
    };
    return <Badge className={variants[plan]}>{plan.toUpperCase()}</Badge>;
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              Acesso restrito para super administradores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Organizações</h1>
          <p className="text-muted-foreground">
            Gerencie as organizações do sistema
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Organização
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou slug..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
                <SelectItem value="suspended">Suspenso</SelectItem>
              </SelectContent>
            </Select>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Plano" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="basic">Basic</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tenants Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma organização encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organização</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Usuários</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {tenant.contact_email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {tenant.slug}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyLoginUrl(tenant.slug)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(tenant.plan)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{tenant.user_count || 0}</span>
                        <span className="text-muted-foreground">/ {tenant.max_users}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewStats(tenant)}
                        >
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(tenant)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(tenant)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTenant ? 'Editar Organização' : 'Nova Organização'}
            </DialogTitle>
            <DialogDescription>
              {selectedTenant
                ? 'Atualize os dados da organização'
                : 'Preencha os dados para criar uma nova organização'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL)</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    })
                  }
                  required
                  disabled={!!selectedTenant}
                  placeholder="minha-organizacao"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plan">Plano</Label>
                <Select value={formData.plan} onValueChange={handlePlanChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((plan) => (
                      <SelectItem key={plan.value} value={plan.value}>
                        {plan.label} ({plan.users} usuários)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTenant && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="max_users">Máx. Usuários</Label>
                <Input
                  id="max_users"
                  type="number"
                  value={formData.max_users}
                  onChange={(e) =>
                    setFormData({ ...formData, max_users: parseInt(e.target.value) })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_storage_gb">Máx. Storage (GB)</Label>
                <Input
                  id="max_storage_gb"
                  type="number"
                  value={formData.max_storage_gb}
                  onChange={(e) =>
                    setFormData({ ...formData, max_storage_gb: parseInt(e.target.value) })
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email de Contato</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_email: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Telefone</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) =>
                    setFormData({ ...formData, contact_phone: e.target.value })
                  }
                />
              </div>
            </div>

            {!selectedTenant && (
              <>
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-3">Administrador da Organização</h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="owner_name">Nome do Administrador</Label>
                      <Input
                        id="owner_name"
                        value={formData.owner_name}
                        onChange={(e) =>
                          setFormData({ ...formData, owner_name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="owner_email">Email</Label>
                        <Input
                          id="owner_email"
                          type="email"
                          value={formData.owner_email}
                          onChange={(e) =>
                            setFormData({ ...formData, owner_email: e.target.value })
                          }
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="owner_password">Senha</Label>
                        <Input
                          id="owner_password"
                          type="password"
                          value={formData.owner_password}
                          onChange={(e) =>
                            setFormData({ ...formData, owner_password: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {selectedTenant ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats Dialog */}
      <Dialog open={isStatsDialogOpen} onOpenChange={setIsStatsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estatísticas - {selectedTenant?.name}</DialogTitle>
          </DialogHeader>

          {tenantStats && (
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{tenantStats.user_count}</p>
                      <p className="text-sm text-muted-foreground">
                        de {tenantStats.max_users} usuários
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <HardDrive className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{tenantStats.storage_used_gb} GB</p>
                      <p className="text-sm text-muted-foreground">
                        de {tenantStats.max_storage_gb} GB
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{tenantStats.document_count}</p>
                      <p className="text-sm text-muted-foreground">documentos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{tenantStats.video_count}</p>
                      <p className="text-sm text-muted-foreground">vídeos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tenants;
