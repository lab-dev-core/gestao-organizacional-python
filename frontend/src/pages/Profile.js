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
import { User, Camera, Loader2, Sun, Moon, Globe } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const ProfilePage = () => {
  const { user, updateUser, getAuthHeaders } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { language, toggleLanguage, t, isPortuguese } = useLanguage();
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    address: user?.address || { cep: '', street: '', number: '', complement: '', neighborhood: '', city: '', state: '' }
  });

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
    setLoading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.put(`${API_URL}/users/${user.id}`, formData, { headers });
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
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const headers = getAuthHeaders();
      const response = await axios.post(`${API_URL}/users/${user.id}/photo`, formData, {
        headers: { ...headers, 'Content-Type': 'multipart/form-data' }
      });
      updateUser({ photo_url: response.data.photo_url });
      toast.success('Foto atualizada com sucesso');
    } catch (error) {
      toast.error(error.response?.data?.detail || t('errorOccurred'));
    } finally {
      setUploading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="space-y-6 max-w-2xl" data-testid="profile-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('profile')}</h1>
        <p className="text-muted-foreground mt-1">Gerencie suas informações pessoais</p>
      </div>

      {/* Photo Section */}
      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="w-24 h-24 border-4 border-primary/20">
                <AvatarImage src={user?.photo_url ? `${process.env.REACT_APP_BACKEND_URL}${user.photo_url}` : undefined} />
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
                  accept="image/*"
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card className="border-0 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Informações Pessoais</CardTitle>
          <CardDescription>Atualize suas informações de contato</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
            </div>

            <Separator className="my-4" />

            <h3 className="font-semibold">{t('address')}</h3>
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

            <div className="pt-4">
              <Button type="submit" disabled={loading} data-testid="profile-save-btn">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Preferences */}
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
            <Switch
              checked={isDark}
              onCheckedChange={toggleTheme}
              data-testid="theme-switch"
            />
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
            <Button
              variant="outline"
              size="sm"
              onClick={toggleLanguage}
              data-testid="language-switch"
            >
              {isPortuguese ? 'EN' : 'PT'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage;
