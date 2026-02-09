import React, { useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Upload, Loader2, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';

const DocumentForm = ({
  open,
  onOpenChange,
  formData,
  setFormData,
  editingDoc,
  selectedFile,
  onFileChange,
  onSubmit,
  uploading,
  selectedStage,
  t,
}) => {
  const fileInputRef = useRef(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingDoc ? t('editDocument') : t('newDocument')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <form onSubmit={onSubmit} className="space-y-4">
            {!editingDoc && (
              <div className="space-y-2">
                <Label>{t('selectFile')} *</Label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {selectedFile ? selectedFile.name : t('dragDrop')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                    onChange={onFileChange}
                    className="hidden"
                    data-testid="document-file-input"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('title')} *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
                data-testid="document-title-input"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('category')}</Label>
              <Input
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Ex: Manual, Apostila, Exercício"
                data-testid="document-category-input"
              />
            </div>

            <div className="space-y-2">
              <Label>{t('description')}</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                data-testid="document-description-input"
              />
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm font-medium flex items-center gap-2">
                <GraduationCap className="w-4 h-4" />
                Etapa: {selectedStage?.name}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Este documento será acessível apenas para usuários desta etapa formativa
              </p>
            </div>

            <DialogFooter className="pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">{t('cancel')}</Button>
              </DialogClose>
              <Button type="submit" disabled={uploading} data-testid="document-submit-btn">
                {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentForm;
