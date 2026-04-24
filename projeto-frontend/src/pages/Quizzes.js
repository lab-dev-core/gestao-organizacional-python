import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../components/ui/alert-dialog';
import { ScrollArea } from '../components/ui/scroll-area';
import { Progress } from '../components/ui/progress';
import { Plus, Pencil, Trash2, ClipboardCheck, ChevronLeft, GraduationCap, CheckCircle2, XCircle, Users, Loader2, HelpCircle, ListChecks } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const newQuestion = () => ({
  id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  text: '',
  type: 'multiple_choice',
  options: ['', ''],
  correct_answer: '',
});

const QuizzesPage = () => {
  const { getAuthHeaders, isAdmin, isFormador, user } = useAuth();
  const canManage = isAdmin || isFormador;

  const [quizzes, setQuizzes] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [view, setView] = useState('list'); // list | take | results | manage
  const [submission, setSubmission] = useState(null);
  const [myResult, setMyResult] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    formative_stage_id: '',
    pass_score: 70,
    is_active: true,
    questions: [newQuestion()],
  });

  const fetchData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const [quizRes, stagesRes] = await Promise.allSettled([
        axios.get(`${API_URL}/quizzes`, { headers }),
        axios.get(`${API_URL}/formative-stages`, { headers }),
      ]);
      if (quizRes.status === 'fulfilled') setQuizzes(quizRes.value.data);
      if (stagesRes.status === 'fulfilled') setStages(stagesRes.value.data.sort((a, b) => a.order - b.order));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const resetForm = () => {
    setFormData({ title: '', description: '', formative_stage_id: '', pass_score: 70, is_active: true, questions: [newQuestion()] });
    setEditingQuiz(null);
  };

  const handleOpenDialog = (quiz = null) => {
    if (quiz) {
      setEditingQuiz(quiz);
      setFormData({
        title: quiz.title,
        description: quiz.description || '',
        formative_stage_id: quiz.formative_stage_id || '',
        pass_score: quiz.pass_score ?? 70,
        is_active: quiz.is_active !== false,
        questions: quiz.questions?.length ? quiz.questions.map(q => ({ ...q, options: q.options?.length ? q.options : ['', ''] })) : [newQuestion()],
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSaveQuiz = async (e) => {
    e.preventDefault();
    for (const q of formData.questions) {
      if (!q.text.trim()) { toast.error('Preencha o texto de todas as questões'); return; }
      if (q.type === 'multiple_choice' && q.options.filter(o => o.trim()).length < 2) {
        toast.error('Questões de múltipla escolha precisam de pelo menos 2 opções'); return;
      }
    }
    setSaving(true);
    try {
      const headers = getAuthHeaders();
      const payload = {
        ...formData,
        formative_stage_id: formData.formative_stage_id || null,
        questions: formData.questions.map(q => ({
          ...q,
          options: q.type === 'multiple_choice' ? q.options.filter(o => o.trim()) : [],
          correct_answer: q.type === 'text' ? null : q.correct_answer || null,
        })),
      };
      if (editingQuiz) {
        await axios.put(`${API_URL}/quizzes/${editingQuiz.id}`, payload, { headers });
        toast.success('Questionário atualizado');
      } else {
        await axios.post(`${API_URL}/quizzes`, payload, { headers });
        toast.success('Questionário criado');
      }
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuiz = async (id) => {
    try {
      await axios.delete(`${API_URL}/quizzes/${id}`, { headers: getAuthHeaders() });
      toast.success('Questionário removido');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao remover');
    }
  };

  const handleOpenQuiz = async (quiz) => {
    setSelectedQuiz(quiz);
    setAnswers({});
    setMyResult(null);
    // Check if already submitted
    try {
      const res = await axios.get(`${API_URL}/quizzes/${quiz.id}/my-result`, { headers: getAuthHeaders() });
      setMyResult(res.data);
      setView('result-self');
    } catch {
      setView('take');
    }
  };

  const handleSubmitQuiz = async () => {
    const unanswered = selectedQuiz.questions.filter(q => !answers[q.id] && q.type !== 'text');
    if (unanswered.length > 0) {
      toast.error(`Responda todas as questões (${unanswered.length} sem resposta)`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/quizzes/${selectedQuiz.id}/submit`, { answers }, { headers: getAuthHeaders() });
      setMyResult(res.data);
      setView('result-self');
      toast.success('Questionário enviado!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erro ao enviar respostas');
    } finally {
      setSubmitting(false);
    }
  };

  const handleViewResults = async (quiz) => {
    setSelectedQuiz(quiz);
    try {
      const res = await axios.get(`${API_URL}/quizzes/${quiz.id}/results`, { headers: getAuthHeaders() });
      setAllResults(res.data);
      setView('results');
    } catch (err) {
      toast.error('Erro ao carregar resultados');
    }
  };

  // ── Question builder helpers ────────────────────────────────────────────────

  const updateQuestion = (idx, field, value) => {
    setFormData(p => {
      const qs = [...p.questions];
      qs[idx] = { ...qs[idx], [field]: value };
      return { ...p, questions: qs };
    });
  };

  const addOption = (qIdx) => {
    setFormData(p => {
      const qs = [...p.questions];
      qs[qIdx] = { ...qs[qIdx], options: [...(qs[qIdx].options || []), ''] };
      return { ...p, questions: qs };
    });
  };

  const updateOption = (qIdx, oIdx, value) => {
    setFormData(p => {
      const qs = [...p.questions];
      const opts = [...qs[qIdx].options];
      opts[oIdx] = value;
      qs[qIdx] = { ...qs[qIdx], options: opts };
      return { ...p, questions: qs };
    });
  };

  const removeOption = (qIdx, oIdx) => {
    setFormData(p => {
      const qs = [...p.questions];
      const opts = qs[qIdx].options.filter((_, i) => i !== oIdx);
      qs[qIdx] = { ...qs[qIdx], options: opts, correct_answer: '' };
      return { ...p, questions: qs };
    });
  };

  const removeQuestion = (idx) => {
    setFormData(p => ({ ...p, questions: p.questions.filter((_, i) => i !== idx) }));
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const getStageName = (id) => stages.find(s => s.id === id)?.name || 'Todas as etapas';
  const getScoreColor = (score, passScore) => {
    if (score === null || score === undefined) return 'text-muted-foreground';
    if (score >= passScore) return 'text-green-600';
    if (score >= passScore * 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  // ── Views ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Take Quiz View ─────────────────────────────────────────────────────────
  if (view === 'take' && selectedQuiz) {
    return (
      <div className="space-y-6" data-testid="quiz-take-view">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setView('list'); setSelectedQuiz(null); }}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{selectedQuiz.title}</h1>
            <p className="text-sm text-muted-foreground">Nota mínima para aprovação: {selectedQuiz.pass_score}%</p>
          </div>
        </div>

        {selectedQuiz.description && (
          <Card className="border-0 shadow-md">
            <CardContent className="p-4 text-sm text-muted-foreground">{selectedQuiz.description}</CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {selectedQuiz.questions.map((q, idx) => (
            <Card key={q.id} className="border-0 shadow-md">
              <CardContent className="p-5">
                <p className="font-medium mb-3">
                  <span className="text-muted-foreground mr-2">{idx + 1}.</span>
                  {q.text}
                </p>
                {q.type === 'multiple_choice' && (
                  <div className="space-y-2">
                    {q.options.map((opt, oIdx) => (
                      <label key={oIdx} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${answers[q.id] === opt ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                        <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => setAnswers(p => ({ ...p, [q.id]: opt }))} className="text-primary" />
                        <span className="text-sm">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'true_false' && (
                  <div className="flex gap-3">
                    {['Verdadeiro', 'Falso'].map(opt => (
                      <label key={opt} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${answers[q.id] === opt ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                        <input type="radio" name={q.id} value={opt} checked={answers[q.id] === opt} onChange={() => setAnswers(p => ({ ...p, [q.id]: opt }))} className="text-primary" />
                        <span className="text-sm font-medium">{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
                {q.type === 'text' && (
                  <Textarea value={answers[q.id] || ''} onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))} placeholder="Sua resposta..." rows={3} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-end gap-3 pb-6">
          <Button variant="outline" onClick={() => { setView('list'); setSelectedQuiz(null); }}>Cancelar</Button>
          <Button onClick={handleSubmitQuiz} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardCheck className="w-4 h-4 mr-2" />}
            Enviar Respostas
          </Button>
        </div>
      </div>
    );
  }

  // ── Self Result View ────────────────────────────────────────────────────────
  if (view === 'result-self' && myResult) {
    const passed = myResult.passed;
    const score = myResult.score;
    return (
      <div className="space-y-6" data-testid="quiz-result-view">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setView('list'); setSelectedQuiz(null); }}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Resultado: {selectedQuiz?.title}</h1>
        </div>

        <Card className={`border-0 shadow-md ${passed ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
          <CardContent className="p-8 text-center">
            {passed ? (
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            ) : (
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            )}
            <p className="text-4xl font-bold mb-2">{score !== null ? `${Math.round(score)}%` : 'Enviado'}</p>
            <p className={`text-lg font-semibold ${passed ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              {passed ? 'Aprovado!' : score !== null ? `Não aprovado (mínimo: ${selectedQuiz?.pass_score}%)` : 'Resposta enviada para avaliação'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Enviado em {new Date(myResult.submitted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </CardContent>
        </Card>

        <Button variant="outline" onClick={() => { setView('list'); setSelectedQuiz(null); }}>
          Voltar aos Questionários
        </Button>
      </div>
    );
  }

  // ── All Results View ────────────────────────────────────────────────────────
  if (view === 'results' && selectedQuiz) {
    return (
      <div className="space-y-6" data-testid="quiz-results-view">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => { setView('list'); setSelectedQuiz(null); }}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Resultados: {selectedQuiz.title}</h1>
            <p className="text-sm text-muted-foreground">{allResults.length} resposta{allResults.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {allResults.length === 0 ? (
          <Card className="border-0 shadow-md">
            <CardContent className="py-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma resposta recebida ainda</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {allResults.map(r => (
              <Card key={r.id} className="border-0 shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-medium">{r.user_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.submitted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      {r.score !== null ? (
                        <>
                          <p className={`text-xl font-bold ${getScoreColor(r.score, selectedQuiz.pass_score)}`}>
                            {Math.round(r.score)}%
                          </p>
                          {r.passed !== null && (
                            <Badge className={r.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {r.passed ? 'Aprovado' : 'Reprovado'}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge variant="outline">Resposta aberta</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── List View ───────────────────────────────────────────────────────────────

  // Group by stage
  const byStage = {};
  quizzes.forEach(q => {
    const key = q.formative_stage_id || '__all__';
    if (!byStage[key]) byStage[key] = [];
    byStage[key].push(q);
  });

  return (
    <div className="space-y-6" data-testid="quizzes-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ListChecks className="w-8 h-8 text-primary" />
            Questionários
          </h1>
          <p className="text-muted-foreground mt-1">Avaliações e questionários por etapa formativa</p>
        </div>
        {canManage && (
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Questionário
          </Button>
        )}
      </div>

      {quizzes.length === 0 ? (
        <Card className="border-0 shadow-md">
          <CardContent className="py-16 text-center text-muted-foreground">
            <HelpCircle className="w-16 h-16 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Nenhum questionário cadastrado</p>
            {canManage && <Button variant="link" onClick={() => handleOpenDialog()} className="mt-2">Criar primeiro questionário</Button>}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(byStage).map(([stageId, stageQuizzes]) => {
            const stageName = stageId === '__all__' ? 'Geral (todas as etapas)' : getStageName(stageId);
            return (
              <div key={stageId}>
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{stageName}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stageQuizzes.map(quiz => (
                    <Card key={quiz.id} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold truncate">{quiz.title}</h3>
                            {quiz.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{quiz.description}</p>
                            )}
                          </div>
                          {!quiz.is_active && <Badge variant="outline" className="text-xs shrink-0">Inativo</Badge>}
                        </div>

                        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                          <span>{quiz.questions?.length || 0} quest.</span>
                          <span>Mín: {quiz.pass_score}%</span>
                          {canManage && <span className="ml-auto">{quiz.submission_count || 0} resp.</span>}
                        </div>

                        <div className="flex items-center gap-2 mt-4 pt-3 border-t">
                          {!canManage && (
                            <Button size="sm" className="flex-1" onClick={() => handleOpenQuiz(quiz)}>
                              <ClipboardCheck className="w-3.5 h-3.5 mr-1.5" />
                              Responder
                            </Button>
                          )}
                          {canManage && (
                            <>
                              <Button size="sm" variant="outline" className="flex-1" onClick={() => handleViewResults(quiz)}>
                                <Users className="w-3.5 h-3.5 mr-1.5" />
                                Resultados
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleOpenDialog(quiz)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover questionário?</AlertDialogTitle>
                                    <AlertDialogDescription>Todas as respostas também serão removidas.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteQuiz(quiz.id)} className="bg-destructive hover:bg-destructive/90">Remover</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quiz Builder Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingQuiz ? 'Editar Questionário' : 'Novo Questionário'}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[75vh] pr-3">
            <form onSubmit={handleSaveQuiz} className="space-y-6">
              {/* Basic info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Questionário de Compreensão - Módulo 1" required />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Instruções para o participante..." rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Etapa Formativa</Label>
                    <Select value={formData.formative_stage_id} onValueChange={v => setFormData(p => ({ ...p, formative_stage_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Todas as etapas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todas as etapas</SelectItem>
                        {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nota mínima (%)</Label>
                    <Input type="number" min={0} max={100} value={formData.pass_score} onChange={e => setFormData(p => ({ ...p, pass_score: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Questões ({formData.questions.length})</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setFormData(p => ({ ...p, questions: [...p.questions, newQuestion()] }))}>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar
                  </Button>
                </div>

                {formData.questions.map((q, qIdx) => (
                  <Card key={q.id} className="border border-border shadow-none">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-muted-foreground w-5">{qIdx + 1}.</span>
                        <div className="flex-1">
                          <Input value={q.text} onChange={e => updateQuestion(qIdx, 'text', e.target.value)} placeholder="Texto da questão..." />
                        </div>
                        <Select value={q.type} onValueChange={v => updateQuestion(qIdx, 'type', v)}>
                          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="multiple_choice">Múltipla Escolha</SelectItem>
                            <SelectItem value="true_false">Verdadeiro/Falso</SelectItem>
                            <SelectItem value="text">Resposta Livre</SelectItem>
                          </SelectContent>
                        </Select>
                        {formData.questions.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={() => removeQuestion(qIdx)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {q.type === 'multiple_choice' && (
                        <div className="pl-7 space-y-2">
                          {q.options.map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input type="radio" name={`correct_${q.id}`} checked={q.correct_answer === opt && opt.trim() !== ''} onChange={() => updateQuestion(qIdx, 'correct_answer', opt)} className="text-primary flex-shrink-0" title="Marcar como correta" />
                              <Input value={opt} onChange={e => updateOption(qIdx, oIdx, e.target.value)} placeholder={`Opção ${oIdx + 1}`} className="h-8 text-sm" />
                              {q.options.length > 2 && (
                                <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => removeOption(qIdx, oIdx)}>
                                  <XCircle className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button type="button" size="sm" variant="ghost" onClick={() => addOption(qIdx)} className="h-7 text-xs">
                            <Plus className="w-3 h-3 mr-1" />
                            Opção
                          </Button>
                          <p className="text-xs text-muted-foreground">Selecione o botão de rádio da opção correta</p>
                        </div>
                      )}

                      {q.type === 'true_false' && (
                        <div className="pl-7 flex gap-4">
                          {['Verdadeiro', 'Falso'].map(opt => (
                            <label key={opt} className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name={`correct_${q.id}`} checked={q.correct_answer === opt} onChange={() => updateQuestion(qIdx, 'correct_answer', opt)} className="text-primary" />
                              <span className="text-sm">{opt}</span>
                            </label>
                          ))}
                          <p className="text-xs text-muted-foreground self-center ml-2">Selecione a correta</p>
                        </div>
                      )}

                      {q.type === 'text' && (
                        <p className="pl-7 text-xs text-muted-foreground">Resposta livre — será avaliada manualmente</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingQuiz ? 'Salvar' : 'Criar Questionário'}
                </Button>
              </DialogFooter>
            </form>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuizzesPage;
