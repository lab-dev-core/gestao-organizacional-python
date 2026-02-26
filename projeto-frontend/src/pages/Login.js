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
import { Separator } from '../components/ui/separator';
import { GraduationCap, Sun, Moon, Globe, Eye, EyeOff, Loader2, Building2, Shield, KeyRound, ArrowLeft, Mail } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Login = () => {
  const [searchParams] = useSearchParams();
  const tenantSlugFromUrl = searchParams.get('org');

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState(tenantSlugFromUrl || '');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tenantInfo, setTenantInfo] = useState(null);
  const [loginType, setLoginType] = useState('organization');

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const { login, getTenantBySlug } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();

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

      await login(identifier, password, slug);
      toast.success(t('loginSuccess'));
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    try {
      const params = tenantSlug ? `?tenant_slug=${tenantSlug}` : '';
      await axios.post(`${API_URL}/auth/password-reset/request${params}`, { email: resetEmail });
      setResetSent(true);
    } catch (err) {
      toast.error('Erro ao solicitar recuperação de senha');
    } finally {
      setResetLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
        style={{ backgroundImage: `url('https://images.pexels.com/photos/5712501/pexels-photo-5712501.jpeg')` }}
      >
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <Button variant="outline" size="icon" onClick={toggleLanguage} className="bg-background/80 backdrop-blur-sm">
            <Globe className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={toggleTheme} className="bg-background/80 backdrop-blur-sm">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
        </div>

        <Card className="w-full max-w-md relative z-10 shadow-2xl border-0 bg-card/95 backdrop-blur-xl">
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                <KeyRound className="w-9 h-9 text-primary-foreground" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-bold tracking-tight">Recuperar Senha</CardTitle>
              <CardDescription className="text-muted-foreground mt-1">
                {resetSent ? 'Verifique seu e-mail' : 'Informe seu e-mail para receber o link de recuperação'}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {resetSent ? (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Se o e-mail <strong>{resetEmail}</strong> estiver cadastrado, você receberá as instruções em breve.
                </p>
                <Button
                  className="w-full h-12 rounded-full font-semibold"
                  onClick={() => { setShowForgotPassword(false); setResetSent(false); setResetEmail(''); }}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">E-mail cadastrado</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    className="h-12"
                  />
                </div>
                <Button type="submit" className="w-full h-12 rounded-full font-semibold" disabled={resetLoading}>
                  {resetLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Enviar Link de Recuperação
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setShowForgotPassword(false)}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('https://images.pexels.com/photos/5712501/pexels-photo-5712501.jpeg')` }}
      data-testid="login-page"
    >
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />

      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button variant="outline" size="icon" onClick={toggleLanguage} className="bg-background/80 backdrop-blur-sm" data-testid="login-language-toggle">
          <Globe className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={toggleTheme} className="bg-background/80 backdrop-blur-sm" data-testid="login-theme-toggle">
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>

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
              <Label htmlFor="identifier" className="text-sm font-medium">
                E-mail, usuário ou CPF
              </Label>
              <Input
                id="identifier"
                type="text"
                placeholder="seu@email.com ou nome.usuario ou CPF"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="h-12"
                data-testid="login-email-input"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">
                  {t('password')}
                </Label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs text-primary hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
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
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-12 px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  data-testid="toggle-password-visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
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
            <>
              <div className="relative my-5">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  ou continue com
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-11 flex items-center gap-2"
                  onClick={() => toast.info('Integração SSO em configuração. Entre em contato com o administrador.')}
                  type="button"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </Button>
                <Button
                  variant="outline"
                  className="h-11 flex items-center gap-2"
                  onClick={() => toast.info('Integração SSO em configuração. Entre em contato com o administrador.')}
                  type="button"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#00A4EF">
                    <path d="M11.4 24H0V12.6L11.4 24zM12.6 24L24 12.6V24H12.6zM24 11.4L12.6 0H24v11.4zM11.4 0L0 11.4V0h11.4z"/>
                  </svg>
                  Microsoft
                </Button>
              </div>

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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
