import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Pencil, Trash2, Calendar, Clock, MapPin } from 'lucide-react';

const AcompanhamentoCard = ({
  acomp,
  canManage,
  onView,
  onEdit,
  onDelete,
  t,
}) => {
  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getFrequencyLabel = (freq) => {
    return freq === 'weekly' ? 'Semanal' : 'Quinzenal';
  };

  return (
    <Card
      className="border-0 shadow-md card-hover cursor-pointer"
      onClick={() => onView(acomp)}
      data-testid={`acomp-card-${acomp.id}`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 border-2 border-primary/20">
            <AvatarFallback className="bg-emerald-500/10 text-emerald-600 text-lg">
              {getInitials(acomp.user_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-lg">{acomp.user_name}</h3>
                <p className="text-sm text-muted-foreground">
                  por {acomp.formador_name}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {getFrequencyLabel(acomp.frequency)}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {formatDate(acomp.date)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {acomp.time}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {acomp.location}
              </span>
            </div>

            <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
              {acomp.content}
            </p>

            {canManage && (
              <div className="flex items-center gap-2 mt-4 pt-3 border-t" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(acomp)}
                  data-testid={`edit-acomp-${acomp.id}`}
                >
                  <Pencil className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      data-testid={`delete-acomp-${acomp.id}`}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Excluir
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
                      <AlertDialogAction onClick={() => onDelete(acomp.id)}>
                        {t('delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AcompanhamentoCard;
