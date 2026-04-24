import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '../ui/popover';
import { Sun, Moon, Globe, LogOut, User, Settings, Menu, Bell, AlertTriangle, CalendarClock, Cake, Heart } from 'lucide-react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const Header = ({ onMenuClick }) => {
  const { user, logout, getAuthHeaders, isAdmin, isFormador } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const [alerts, setAlerts] = useState(null);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const fetchAlerts = useCallback(async () => {
    if (!isAdmin && !isFormador) return;
    try {
      const res = await axios.get(`${API_URL}/stats/alerts`, { headers: getAuthHeaders() });
      setAlerts(res.data);
    } catch (err) {
      // silently fail — alerts are non-critical
    }
  }, [getAuthHeaders, isAdmin, isFormador]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (role) => {
    const roleColors = {
      admin: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      formador: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      user: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    };
    const roleLabels = {
      admin: t('admin'),
      formador: t('formadorRole'),
      user: t('user')
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[role]}`}>
        {roleLabels[role]}
      </span>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  const totalAlerts = alerts?.total_count || 0;
  const hasUrgent = (alerts?.overdue_acompanhamentos?.length || 0) > 0 ||
                    (alerts?.scheduled_today?.length || 0) > 0;

  return (
    <header
      className="h-16 border-b border-border bg-background/80 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-4 md:px-6"
      data-testid="header"
    >
      {/* Left side */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuClick}
          data-testid="mobile-menu-btn"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <div className="hidden md:block">
          <h1 className="text-lg font-semibold text-foreground">
            {t('welcome')}, {user?.full_name?.split(' ')[0]}!
          </h1>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Notification Bell (admin/formador only) */}
        {(isAdmin || isFormador) && (
          <Popover open={alertsOpen} onOpenChange={(o) => { setAlertsOpen(o); if (o) fetchAlerts(); }}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                data-testid="notification-bell"
              >
                <Bell className="w-5 h-5" />
                {totalAlerts > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${hasUrgent ? 'bg-red-500' : 'bg-primary'}`}>
                    {totalAlerts > 99 ? '99+' : totalAlerts}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end" data-testid="notifications-panel">
              <div className="px-4 py-3 border-b">
                <h3 className="font-semibold text-sm">Notificações</h3>
                {totalAlerts === 0 && <p className="text-xs text-muted-foreground mt-0.5">Nenhum alerta no momento</p>}
              </div>
              <ScrollArea className="max-h-80">
                <div className="py-2 space-y-0.5">

                  {/* Agendados Hoje */}
                  {alerts?.scheduled_today?.length > 0 && (
                    <div className="px-3 py-1">
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> Agendados para Hoje ({alerts.scheduled_today.length})
                      </p>
                      {alerts.scheduled_today.map(ac => (
                        <button
                          key={ac.id}
                          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm"
                          onClick={() => { navigate('/acompanhamentos'); setAlertsOpen(false); }}
                        >
                          <span className="font-medium">{ac.user_name}</span>
                          <span className="text-muted-foreground text-xs ml-2">{ac.time || ''} • {ac.location}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Atenção: sem acompanhamento */}
                  {alerts?.overdue_acompanhamentos?.length > 0 && (
                    <div className="px-3 py-1">
                      <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Precisam de Atenção ({alerts.overdue_acompanhamentos.length})
                      </p>
                      {alerts.overdue_acompanhamentos.slice(0, 5).map(f => (
                        <button
                          key={f.id}
                          className="w-full text-left px-2 py-1.5 rounded-md hover:bg-muted text-sm"
                          onClick={() => { navigate('/formador-dashboard'); setAlertsOpen(false); }}
                        >
                          <span className="font-medium">{f.full_name}</span>
                          <span className="text-muted-foreground text-xs ml-2">sem acompanhamento recente</span>
                        </button>
                      ))}
                      {alerts.overdue_acompanhamentos.length > 5 && (
                        <p className="text-xs text-muted-foreground px-2 py-1">
                          + {alerts.overdue_acompanhamentos.length - 5} outros
                        </p>
                      )}
                    </div>
                  )}

                  {/* Aniversários próximos */}
                  {alerts?.upcoming_birthdays?.length > 0 && (
                    <div className="px-3 py-1">
                      <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1 flex items-center gap-1">
                        <Cake className="w-3 h-3" /> Aniversários Próximos ({alerts.upcoming_birthdays.length})
                      </p>
                      {alerts.upcoming_birthdays.map(u => (
                        <div key={u.id} className="px-2 py-1.5 text-sm">
                          <span className="font-medium">{u.full_name}</span>
                          <span className="text-muted-foreground text-xs ml-2">
                            {u.days_until === 1 ? 'amanhã' : `em ${u.days_until} dias`} ({formatDate(u.birth_date)})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Aniversários de consagração */}
                  {alerts?.upcoming_community_anniversaries?.length > 0 && (
                    <div className="px-3 py-1">
                      <p className="text-xs font-semibold text-violet-600 dark:text-violet-400 mb-1 flex items-center gap-1">
                        <Heart className="w-3 h-3" /> Aniversários de Consagração ({alerts.upcoming_community_anniversaries.length})
                      </p>
                      {alerts.upcoming_community_anniversaries.map(u => (
                        <div key={u.id} className="px-2 py-1.5 text-sm">
                          <span className="font-medium">{u.full_name}</span>
                          <span className="text-muted-foreground text-xs ml-2">
                            {u.days_until === 1 ? 'amanhã' : `em ${u.days_until} dias`}
                            {u.years ? ` • ${u.years} ano${u.years !== 1 ? 's' : ''}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {totalAlerts === 0 && (
                    <div className="py-6 text-center text-muted-foreground text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>Tudo em ordem!</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
              {totalAlerts > 0 && (
                <div className="px-4 py-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => { navigate('/formador-dashboard'); setAlertsOpen(false); }}
                  >
                    Ver Painel do Formador
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        )}

        {/* Language Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleLanguage}
          className="relative"
          data-testid="language-toggle"
        >
          <Globe className="w-5 h-5" />
          <span className="absolute -bottom-1 -right-1 text-[10px] font-bold bg-primary text-primary-foreground rounded px-1">
            {language.toUpperCase()}
          </span>
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          data-testid="theme-toggle"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full" data-testid="user-menu-trigger">
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                <AvatarImage src={user?.photo_url ? `${process.env.REACT_APP_BACKEND_URL}${user.photo_url}` : undefined} alt={user?.full_name} />
                <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                  {getInitials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-2">
                <p className="text-sm font-medium leading-none">{user?.full_name}</p>
                <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                <div className="pt-1">{getRoleBadge(user?.role)}</div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')} data-testid="profile-menu-item">
              <User className="mr-2 h-4 w-4" />
              <span>{t('profile')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')} data-testid="settings-menu-item">
              <Settings className="mr-2 h-4 w-4" />
              <span>{t('settings')}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive" data-testid="logout-menu-item">
              <LogOut className="mr-2 h-4 w-4" />
              <span>{t('logout')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Header;
