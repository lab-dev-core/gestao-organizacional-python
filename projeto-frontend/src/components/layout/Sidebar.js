import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Users,
  FileText,
  Video,
  MapPin,
  Briefcase,
  GraduationCap,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Building2,
  Shield,
  Route,
  CalendarDays,
  Award
} from 'lucide-react';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';

const Sidebar = ({ collapsed, onToggle }) => {
  const { user, isAdmin, isSuperAdmin, tenant } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  const mainNavItems = [
    { icon: LayoutDashboard, label: t('dashboard'), href: '/dashboard' },
    { icon: Users, label: t('users'), href: '/users' },
    { icon: Route, label: t('userJourney'), href: '/user-journey' },
    { icon: FileText, label: t('documents'), href: '/documents' },
    { icon: Video, label: t('videos'), href: '/videos' },
    { icon: MessageSquare, label: 'Acompanhamentos', href: '/acompanhamentos' },
    { icon: Award, label: t('certificates'), href: '/certificates' },
  ];

  const adminNavItems = [
    { icon: MapPin, label: t('locations'), href: '/locations' },
    { icon: Briefcase, label: t('functions'), href: '/functions' },
    { icon: GraduationCap, label: t('formativeStages'), href: '/formative-stages' },
    { icon: CalendarDays, label: t('stageCycles'), href: '/stage-cycles' },
    { icon: ClipboardList, label: t('auditLogs'), href: '/audit-logs' },
  ];

  const superAdminNavItems = [
    { icon: Building2, label: 'Organizações', href: '/tenants' },
  ];

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');

    return (
      <NavLink to={item.href}>
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
            'hover:bg-accent hover:text-accent-foreground',
            isActive && 'bg-primary/10 text-primary font-medium',
            collapsed && 'justify-center px-2'
          )}
        >
          <item.icon className={cn('w-5 h-5 flex-shrink-0', isActive && 'text-primary')} strokeWidth={1.5} />
          {!collapsed && (
            <span className="text-sm truncate">{item.label}</span>
          )}
        </div>
      </NavLink>
    );
  };

  return (
    <aside
      className={cn(
        'h-screen border-r border-border bg-card flex flex-col transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className={cn(
        'h-16 flex items-center border-b border-border px-4',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg font-heading">FormaPro</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Tenant Info */}
      {!collapsed && tenant && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium truncate">{tenant.name}</span>
          </div>
          <Badge variant="outline" className="mt-1 text-xs">
            {tenant.plan?.toUpperCase()}
          </Badge>
        </div>
      )}

      {/* SuperAdmin Badge */}
      {!collapsed && isSuperAdmin && (
        <div className="px-4 py-3 border-b border-border bg-amber-50 dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              Super Admin
            </span>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 py-4">
        {/* SuperAdmin Section */}
        {isSuperAdmin && (
          <>
            {!collapsed && (
              <div className="px-4 mb-2">
                <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
                  Sistema
                </span>
              </div>
            )}
            <nav className="px-3 space-y-1 mb-4">
              {superAdminNavItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </nav>
            <Separator className="my-4 mx-3" />
          </>
        )}

        <nav className="px-3 space-y-1">
          {mainNavItems.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
        </nav>

        {isAdmin && (
          <>
            <Separator className="my-4 mx-3" />
            {!collapsed && (
              <div className="px-4 mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Admin
                </span>
              </div>
            )}
            <nav className="px-3 space-y-1">
              {adminNavItems.map((item) => (
                <NavItem key={item.href} item={item} />
              ))}
            </nav>
          </>
        )}
      </ScrollArea>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn('w-full', collapsed && 'px-0')}
          data-testid="sidebar-toggle"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 mr-2" />
              <span className="text-sm">{t('close')}</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
