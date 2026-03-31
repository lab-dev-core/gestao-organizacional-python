import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Switch } from '../components/ui/switch';
import { Separator } from '../components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { User, Camera, Loader2, Sun, Moon, Globe, Heart, Church, Stethoscope, Home } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const EDUCATION_LEVELS = [
  'fundamental_incompleto', 'fundamental_completo',
  'medio_incompleto', 'medio_completo',
  'superior_incompleto', 'superior_completo',
  'pos_graduacao', 'mestrado', 'doutorado'
];

const MARITAL_STATUS_OPTIONS = [
  'solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel', 'outro'
];

const SACRAMENT_KEYS = [
  { key: 'baptism', label: 'baptism' },
  { key: 'first_communion', label: 'firstCommunion' },
  { key: 'confirmation', label: 'confirmation' },
  { key: 'marriage', label: 'marriage' },
];

const ProfilePage = () => {
  const { user, updateUser, getAuthHeaders, isAdmin, isFormador } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const { toggleLanguage, t, isPortuguese } = useLanguage();

  const canSeeHealthInfo = isAdmin || isFormador;

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    education_level: user?.education_level || '',
    family_contact: user?.family_contact || { name: '', phone: '', relationship: '' },
    address: user?.address || { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' },

    marital_status: user?.marital_status || '',
    has_children: user?.has_children ?? null,
    children_count: user?.children_count ?? '',
    children_names: user?.children_names || '',

    community_entry_date: user?.community_entry_date || '',
    community_entry_place: user?.community_entry_place || '',
    consecration_date: user?.consecration_date || '',

    sacraments: user?.sacraments || {
      baptism: false, baptism_date: '',
      first_communion: false, first_communion_date: '',
      confirmation: false, confirmation_date: '',
      marriage: false, marriage_date: '',
    },

    psychiatric_followup: user?.psychiatric_followup ?? null,
    psychiatric_medication: user?.psychiatric_medication ?? null,
    psychological_followup: user?.psychological_followup ?? null,
  });

  const handleChange = (field, value) => {
    const parts = field.split('.');
    if (parts.length === 2) {
      const [parent, child] = parts;
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
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const payload = { ...formData };
      if (!payload.marital_status) delete payload.marital_status;
      if (!payload.community_entry_date) delete payload.community_entry_date;
      if (!payload.community_entry_place) delete payload.community_entry_place;
      if (!payload.consecration_date) delete payload.consecration_date;
      if (payload.children_count === '') delete payload.children_count;
      if (!payload.education_level) delete payload.education_level;

      const response = await axios.put(`${API_URL}/users/${user.id}`, payload, { headers });
      updateUser(response.data);
      toast.success(t('savedSuccessfully'));
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !user?.id) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido. Use JPG, PNG, GIF ou WEBP.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A foto deve ter no máximo 5 MB.');
      e.target.value = '';
      return;
    }

    const photoFormData = new FormData();
    photoFormData.append('file', file);

    setUploading(true);
    try {
      const authHeaders = getAuthHeaders();
      // Não definir Content-Type — o browser gera com o boundary correto para multipart
      const response = await axios.post(
        `${API_URL}/users/${user.id}/photo`,
        photoFormData,
        { headers: authHeaders }
      );
      updateUser({ photo_url: response.data.photo_url });
      toast.success('Foto atualizada com sucesso');
    } catch (error) {
      const msg = error.response?.data?.detail || t('errorOccurred');
      toast.error(`Erro ao enviar foto: ${msg}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const photoSrc = user?.photo_url
    ? `${process.env.REACT_APP_BACKEND_URL}${user.photo_url}`
    : undefined;

  const YesNoSelect = ({ field, label }) => (
    <div className="flex items-center justify-between py-2">
      <Label>{label}</Label>
      <Select
        value={formData[field] === null || formData[field] === undefined ? 'null' : String(formData[field])}
        onValueChange={(v) => handleChange(field, v === 'null' ? null : v === 'true')}
      >
        <SelectTrigger className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="null">Não informado</SelectItem>
          <SelectItem value="true">{t('yes')}</SelectItem>
          <SelectItem value="false">{t('no')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6 max-w-2xl" data-testid="profile-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('profile')}</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais</p>
      </div>

      {/* ── Foto ────────────────────────────────────────────────────────── */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-primary/20">
                <AvatarImage src={photoSrc} alt={user?.full_name} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {getInitials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  disabled={uploading}
                  data-testid="photo-upload-input"
                />
              </label>
            </div>
            <div>
              <h2 className="text-xl font-semibold">{user?.full_name}</h2>
              <p className="text-muted-foreground">{user?.email}</p>
              {user?.roles && (
                <div className="flex gap-1 mt-1">
                  {(user.roles || []).map(r => (
                    <span key={r} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">{r}</span>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, GIF ou WEBP · máx. 5 MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* ── Informações Pessoais ─────────────────────────────────────── */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-4 h-4" /> Informações Pessoais
            </CardTitle>
            <CardDescription>Dados básicos de contato e identificação</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('fullName')}</Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  data-testid="profile-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('phone')}</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  data-testid="profile-phone-input"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('maritalStatus')}</Label>
                <Select
                  value={formData.marital_status || 'none'}
                  onValueChange={(v) => handleChange('marital_status', v === 'none' ? '' : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {MARITAL_STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{t(opt)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('educationLevel')}</Label>
                <Select
                  value={formData.education_level || 'none'}
                  onValueChange={(v) => handleChange('education_level', v === 'none' ? '' : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Selecione...</SelectItem>
                    {EDUCATION_LEVELS.map(level => (
                      <SelectItem key={level} value={level}>{t(level)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Filhos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('hasChildren')}</Label>
                <Select
                  value={formData.has_children === null || formData.has_children === undefined ? 'null' : String(formData.has_children)}
                  onValueChange={(v) => handleChange('has_children', v === 'null' ? null : v === 'true')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="null">Não informado</SelectItem>
                    <SelectItem value="true">{t('yes')}</SelectItem>
                    <SelectItem value="false">{t('no')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {formData.has_children === true && (
                <div className="space-y-2">
                  <Label>{t('childrenCount')}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.children_count}
                    onChange={(e) => handleChange('children_count', e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              )}
            </div>
            {formData.has_children === true && (
              <div className="space-y-2">
                <Label>Nomes dos filhos</Label>
                <Input
                  value={formData.children_names}
                  onChange={(e) => handleChange('children_names', e.target.value)}
                  placeholder="Ex: Maria, João, Ana..."
                />
              </div>
            )}

            <Separator />

            {/* Contato da Família */}
            <h3 className="font-semibold text-sm">{t('familyContact')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('familyContactName')}</Label>
                <Input
                  value={formData.family_contact?.name || ''}
                  onChange={(e) => handleChange('family_contact.name', e.target.value)}
                  placeholder="Nome do familiar"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('familyContactPhone')}</Label>
                <Input
                  value={formData.family_contact?.phone || ''}
                  onChange={(e) => handleChange('family_contact.phone', e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('familyContactRelationship')}</Label>
                <Input
                  value={formData.family_contact?.relationship || ''}
                  onChange={(e) => handleChange('family_contact.relationship', e.target.value)}
                  placeholder="Ex: Mãe, Pai, Cônjuge"
                />
              </div>
            </div>

            <Separator />

            {/* Endereço */}
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Home className="w-4 h-4" /> {t('address')}
            </h3>
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
          </CardContent>
        </Card>

        {/* ── Informações na Comunidade ────────────────────────────────── */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="w-4 h-4" /> {t('communityInfo')}
            </CardTitle>
            <CardDescription>Dados de ingresso e acolhimento na comunidade</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('communityEntryDate')}</Label>
                <Input
                  type="date"
                  value={formData.community_entry_date || ''}
                  onChange={(e) => handleChange('community_entry_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('communityEntryPlace')}</Label>
                <Input
                  value={formData.community_entry_place || ''}
                  onChange={(e) => handleChange('community_entry_place', e.target.value)}
                  placeholder={t('communityEntryPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <Label>Data de consagração</Label>
                <Input
                  type="date"
                  value={formData.consecration_date || ''}
                  onChange={(e) => handleChange('consecration_date', e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Sacramentos ──────────────────────────────────────────────── */}
        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Church className="w-4 h-4" /> {t('sacraments')}
            </CardTitle>
            <CardDescription>Sacramentos recebidos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {SACRAMENT_KEYS.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-4">
                <div className="flex items-center gap-3 w-44 shrink-0">
                  <Switch
                    checked={!!formData.sacraments?.[key]}
                    onCheckedChange={(v) => handleChange(`sacraments.${key}`, v)}
                  />
                  <Label className="cursor-pointer">{t(label)}</Label>
                </div>
                {formData.sacraments?.[key] && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{t('date')}:</span>
                    <Input
                      type="date"
                      className="h-8 text-sm w-40"
                      value={formData.sacraments?.[`${key}_date`] || ''}
                      onChange={(e) => handleChange(`sacraments.${key}_date`, e.target.value)}
                    />
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ── Saúde (visível apenas para admin/formador) ───────────────── */}
        {canSeeHealthInfo && (
          <Card className="border-0 shadow-md border-l-4 border-l-amber-400">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Stethoscope className="w-4 h-4" /> {t('healthInfo')}
              </CardTitle>
              <CardDescription>{t('healthInfoDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <YesNoSelect field="psychiatric_followup" label={t('psychiatricFollowup')} />
              <YesNoSelect field="psychiatric_medication" label={t('psychiatricMedication')} />
              <YesNoSelect field="psychological_followup" label={t('psychologicalFollowup')} />
            </CardContent>
          </Card>
        )}

        <div>
          <Button type="submit" disabled={loading} data-testid="profile-save-btn">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('save')}
          </Button>
        </div>
      </form>

      {/* ── Preferências ─────────────────────────────────────────────── */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">{t('settings')}</CardTitle>
          <CardDescription>Personalize sua experiência</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              <div>
                <p className="font-medium">Tema Escuro</p>
                <p className="text-sm text-muted-foreground">Ativar modo escuro</p>
              </div>
            </div>
            <Switch checked={isDark} onCheckedChange={toggleTheme} data-testid="theme-switch" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5" />
              <div>
                <p className="font-medium">Idioma</p>
                <p className="text-sm text-muted-foreground">
                  {isPortuguese ? 'Português (Brasil)' : 'English'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={toggleLanguage} data-testid="language-switch">
              {isPortuguese ? 'EN' : 'PT'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
