import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { FolderOpen, Lock, FileText, GraduationCap } from 'lucide-react';

const StageSelector = ({ stages, documents, onSelectStage, hasAccessToStage, t }) => {
  const getStageDocCount = (stageId) => {
    return documents.filter(doc => doc.formative_stage_id === stageId).length;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {stages.map((stage) => {
        const hasAccess = hasAccessToStage(stage.id);
        const docCount = getStageDocCount(stage.id);

        return (
          <Card
            key={stage.id}
            className={`border-0 shadow-md overflow-hidden transition-all duration-200 ${
              hasAccess
                ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1'
                : 'opacity-60 cursor-not-allowed'
            }`}
            onClick={() => hasAccess && onSelectStage(stage)}
            data-testid={`stage-folder-${stage.id}`}
          >
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className={`p-4 rounded-xl ${hasAccess ? 'bg-primary/10' : 'bg-muted'}`}>
                  {hasAccess ? (
                    <FolderOpen className={`w-8 h-8 ${hasAccess ? 'text-primary' : 'text-muted-foreground'}`} />
                  ) : (
                    <Lock className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {stage.order}
                </Badge>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold text-lg">{stage.name}</h3>
                {stage.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {stage.description}
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="w-4 h-4" />
                  <span>{docCount} {docCount === 1 ? 'documento' : 'documentos'}</span>
                </div>
                {stage.estimated_duration && (
                  <Badge variant="outline" className="text-xs">
                    {stage.estimated_duration}
                  </Badge>
                )}
              </div>

              {!hasAccess && (
                <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  Acesso restrito à sua etapa formativa
                </p>
              )}
            </div>
          </Card>
        );
      })}

      {stages.length === 0 && (
        <Card className="col-span-full border-0 shadow-md">
          <CardContent className="py-16 text-center text-muted-foreground">
            <GraduationCap className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Nenhuma etapa formativa cadastrada</p>
            <p className="text-sm mt-2">Cadastre etapas formativas para organizar os documentos</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StageSelector;
