import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { GraduationCap, Sun, Moon, Globe, Eye, EyeOff, Loader2, Building2, Shield } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const [searchParams] = useSearchParams();
  const tenantSlugFromUrl = searchParams.get('org');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState(tenantSlugFromUrl || '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tenantInfo, setTenantInfo] = useState(null);
  const [loginType, setLoginType] = useState(tenantSlugFromUrl ? 'organization' : 'organization');

  const { login, getTenantBySlug } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();

  // Fetch tenant info when slug changes
  useEffect(() => {
    const fetchTenant = async () => {
      if (tenantSlug && tenantSlug.length >= 3) {
        const tenant = await getTenantBySlug(tenantSlug);
        setTenantInfo(tenant);
      } else {
        setTenantInfo(null);
      }
    };

    const debounce = setTimeout(fetchTenant, 500);
    return () => clearTimeout(debounce);
  }, [tenantSlug, getTenantBySlug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const slug = loginType === 'organization' ? tenantSlug : null;

      if (loginType === 'organization' && !tenantSlug) {
        setError('Por favor, informe o identificador da organização');
        setLoading(false);
        return;
      }

      await login(email, password, slug);
      toast.success(t('loginSuccess'));
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{
        backgroundImage: `url('https://images.pexels.com/photos/5712501/pexels-photo-5712501.jpeg')`,
      }}
      data-testid="login-page"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      {/* Theme & Language toggles */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleLanguage}
          className="bg-background/80 backdrop-blur-sm"
          data-testid="login-language-toggle"
        >
          <Globe className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          className="bg-background/80 backdrop-blur-sm"
          data-testid="login-theme-toggle"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-card/95 backdrop-blur-xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <GraduationCap className="w-9 h-9 text-primary-foreground" />
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold tracking-tight">FormaPro</CardTitle>
            <CardDescription className="text-muted-foreground mt-1">
              {tenantInfo ? tenantInfo.name : t('login')}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          <Tabs value={loginType} onValueChange={setLoginType} className="mb-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="organization" className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Organização
              </TabsTrigger>
              <TabsTrigger value="superadmin" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Administrador
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <Alert variant="destructive" className="animate-fade-in">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {loginType === 'organization' && (
              <div className="space-y-2">
                <Label htmlFor="tenant" className="text-sm font-medium">
                  Identificador da Organização
                </Label>
                <Input
                  id="tenant"
                  type="text"
                  placeholder="minha-organizacao"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required={loginType === 'organization'}
                  className="h-12"
                  data-testid="login-tenant-input"
                />
                {tenantInfo && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {tenantInfo.name}
                  </p>
                )}
                {tenantSlug && tenantSlug.length >= 3 && !tenantInfo && (
                  <p className="text-sm text-red-500">Organização não encontrada</p>
                )}
              </div>
            )}

            {loginType === 'superadmin' && (
              <Alert className="bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
                <Shield className="w-4 h-4" />
                <AlertDescription>
                  Acesso restrito para administradores do sistema.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                {t('email')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
                data-testid="login-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                {t('password')}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12 pr-10"
                  data-testid="login-password-input"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-12 px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Eye className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-full font-semibold shadow-lg shadow-primary/20 transition-transform hover:-translate-y-0.5 active:translate-y-0"
              disabled={loading || (loginType === 'organization' && tenantSlug && !tenantInfo)}
              data-testid="login-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('loading')}
                </>
              ) : (
                t('login')
              )}
            </Button>
          </form>

          {loginType === 'organization' && (
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                {t('noAccount')}{' '}
                <Link
                  to={tenantSlug ? `/register?org=${tenantSlug}` : '/register'}
                  className="text-primary hover:underline font-medium"
                  data-testid="register-link"
                >
                  {t('register')}
                </Link>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
