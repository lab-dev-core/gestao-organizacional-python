import React from 'react';
import { cn } from '../../lib/utils';
import { Check, Circle, ArrowRight, Calendar, User, MessageSquare } from 'lucide-react';
import { Badge } from './badge';
import { Card, CardContent } from './card';

const JourneyTimeline = ({
  stages = [],
  journeyRecords = [],
  currentStageId = null,
  showAllStages = true,
  className
}) => {
  // Criar mapa de transições por etapa
  const transitionsByStage = {};
  journeyRecords.forEach(record => {
    if (record.to_stage_id) {
      transitionsByStage[record.to_stage_id] = record;
    }
  });

  // Encontrar índice da etapa atual
  const currentStageIndex = stages.findIndex(s => s.id === currentStageId);

  // Ordenar etapas por order
  const sortedStages = [...stages].sort((a, b) => (a.order || 0) - (b.order || 0));

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getStageStatus = (stage, index) => {
    const stageIndex = sortedStages.findIndex(s => s.id === stage.id);
    const currentIdx = sortedStages.findIndex(s => s.id === currentStageId);

    if (transitionsByStage[stage.id]) {
      if (stage.id === currentStageId) {
        return 'current';
      }
      return 'completed';
    }

    if (currentIdx >= 0 && stageIndex < currentIdx) {
      return 'completed';
    }

    if (stage.id === currentStageId) {
      return 'current';
    }

    return 'pending';
  };

  return (
    <div className={cn('w-full', className)}>
      {/* Visualização como linha do tempo horizontal em telas grandes */}
      <div className="hidden lg:block">
        <div className="relative flex items-start justify-between">
          {sortedStages.map((stage, index) => {
            const status = getStageStatus(stage, index);
            const transition = transitionsByStage[stage.id];

            return (
              <div
                key={stage.id}
                className="flex flex-col items-center relative"
                style={{ flex: 1 }}
              >
                {/* Linha conectora */}
                {index < sortedStages.length - 1 && (
                  <div
                    className={cn(
                      'absolute top-5 left-1/2 h-0.5 w-full',
                      status === 'completed' ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}

                {/* Círculo do status */}
                <div
                  className={cn(
                    'relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                    status === 'completed' && 'bg-primary border-primary text-primary-foreground',
                    status === 'current' && 'bg-primary/20 border-primary text-primary animate-pulse',
                    status === 'pending' && 'bg-background border-muted text-muted-foreground'
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="w-5 h-5" />
                  ) : status === 'current' ? (
                    <Circle className="w-5 h-5 fill-current" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>

                {/* Informações da etapa */}
                <div className="mt-3 text-center px-2">
                  <p className={cn(
                    'font-medium text-sm',
                    status === 'current' && 'text-primary',
                    status === 'pending' && 'text-muted-foreground'
                  )}>
                    {stage.name}
                  </p>
                  {stage.estimated_duration && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {stage.estimated_duration}
                    </p>
                  )}
                  {transition && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      {formatDate(transition.transition_date)}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visualização vertical para mobile e tablets */}
      <div className="lg:hidden space-y-4">
        {sortedStages.map((stage, index) => {
          const status = getStageStatus(stage, index);
          const transition = transitionsByStage[stage.id];

          return (
            <div key={stage.id} className="flex gap-4">
              {/* Linha vertical e círculo */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center border-2 flex-shrink-0',
                    status === 'completed' && 'bg-primary border-primary text-primary-foreground',
                    status === 'current' && 'bg-primary/20 border-primary text-primary',
                    status === 'pending' && 'bg-background border-muted text-muted-foreground'
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="w-5 h-5" />
                  ) : status === 'current' ? (
                    <Circle className="w-5 h-5 fill-current" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                {index < sortedStages.length - 1 && (
                  <div
                    className={cn(
                      'w-0.5 flex-1 min-h-[40px]',
                      status === 'completed' ? 'bg-primary' : 'bg-muted'
                    )}
                  />
                )}
              </div>

              {/* Card com informações */}
              <Card className={cn(
                'flex-1 mb-2',
                status === 'current' && 'border-primary'
              )}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className={cn(
                        'font-medium',
                        status === 'current' && 'text-primary'
                      )}>
                        {stage.name}
                      </h4>
                      {stage.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {stage.description}
                        </p>
                      )}
                    </div>
                    {status === 'current' && (
                      <Badge>Atual</Badge>
                    )}
                  </div>

                  {stage.estimated_duration && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Duração estimada: {stage.estimated_duration}
                    </p>
                  )}

                  {transition && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>Iniciado em {formatDate(transition.transition_date)}</span>
                      </div>
                      {transition.changed_by_name && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>Por {transition.changed_by_name}</span>
                        </div>
                      )}
                      {transition.notes && (
                        <div className="flex items-start gap-2 text-xs text-muted-foreground mt-2">
                          <MessageSquare className="w-3 h-3 mt-0.5" />
                          <span>{transition.notes}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { JourneyTimeline };
