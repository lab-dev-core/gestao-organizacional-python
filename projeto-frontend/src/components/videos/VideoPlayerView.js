import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Circle, Clock,
  MessageSquare, Send, Star, Play, ExternalLink, Loader2,
  ThumbsUp, CornerDownRight, Trash2, CheckCheck, PlayCircle
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

const formatDuration = (seconds) => {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const formatTimeAgo = (isoString) => {
  if (!isoString) return '';
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return 'agora mesmo';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 2592000) return `há ${Math.floor(diff / 86400)} dias`;
  return `há ${Math.floor(diff / 2592000)} meses`;
};

const StarRating = ({ value, onChange, disabled }) => (
  <div className="flex items-center gap-1">
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && onChange(star)}
        className={`transition-colors ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}`}
      >
        <Star
          className={`w-5 h-5 ${star <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
        />
      </button>
    ))}
  </div>
);

const VideoPlayerView = ({
  video,
  allVideos,
  stage,
  subcategory,
  onVideoChange,
  onBack,
  getAuthHeaders,
  user,
  canManage
}) => {
  const currentIndex = allVideos.findIndex(v => v.id === video.id);
  const prevVideo = currentIndex > 0 ? allVideos[currentIndex - 1] : null;
  const nextVideo = currentIndex < allVideos.length - 1 ? allVideos[currentIndex + 1] : null;

  const [progress, setProgress] = useState({});
  const [isCompleted, setIsCompleted] = useState(false);
  const [marking, setMarking] = useState(false);

  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  const [myRating, setMyRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [submittingEval, setSubmittingEval] = useState(false);
  const [savedRating, setSavedRating] = useState(0);

  const commentInputRef = useRef(null);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const getVideoSrc = useCallback(() => {
    if (video.video_type === 'link') {
      const url = video.external_url || '';
      if (url.includes('youtube.com') || url.includes('youtu.be')) {
        const id = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1];
        return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : url;
      }
      if (url.includes('vimeo.com')) {
        const id = url.match(/vimeo\.com\/(\d+)/)?.[1];
        return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : url;
      }
      return url;
    }
    return `${process.env.REACT_APP_BACKEND_URL}${video.file_url}`;
  }, [video]);

  const isEmbedded = video.video_type === 'link' &&
    (video.external_url?.includes('youtube') || video.external_url?.includes('vimeo'));

  // ─── Load data ───────────────────────────────────────────────────────────────

  const fetchProgress = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      const results = await Promise.allSettled(
        allVideos.map(v => axios.get(`${API_URL}/videos/${v.id}/progress`, { headers }))
      );
      const map = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') map[allVideos[i].id] = r.value.data;
      });
      setProgress(map);
      setIsCompleted(map[video.id]?.completed || false);
    } catch (err) {
      console.error(err);
    }
  }, [allVideos, video.id, getAuthHeaders]);

  const fetchComments = useCallback(async () => {
    setCommentsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/videos/${video.id}/comments`, {
        headers: getAuthHeaders(),
        params: { limit: 100 }
      });
      setComments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setCommentsLoading(false);
    }
  }, [video.id, getAuthHeaders]);

  const fetchMyEvaluation = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/videos/${video.id}/evaluations`, {
        headers: getAuthHeaders()
      });
      const mine = res.data.find(e => e.user_id === user?.id);
      if (mine) {
        setMyRating(mine.score);
        setSavedRating(mine.score);
      } else {
        setMyRating(0);
        setSavedRating(0);
      }
    } catch (err) {
      console.error(err);
    }
  }, [video.id, getAuthHeaders, user?.id]);

  useEffect(() => {
    fetchProgress();
    fetchComments();
    fetchMyEvaluation();
    setNewComment('');
    setReplyTo(null);
  }, [video.id, fetchProgress, fetchComments, fetchMyEvaluation]);

  // ─── Actions ─────────────────────────────────────────────────────────────────

  const handleMarkComplete = async () => {
    setMarking(true);
    try {
      await axios.post(`${API_URL}/videos/${video.id}/progress`,
        { progress_seconds: 0, completed: !isCompleted },
        { headers: getAuthHeaders() }
      );
      setIsCompleted(prev => !prev);
      toast.success(isCompleted ? 'Marcado como não concluído' : 'Aula concluída! 🎉');
      fetchProgress();
    } catch (err) {
      toast.error('Erro ao atualizar progresso');
    } finally {
      setMarking(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await axios.post(`${API_URL}/videos/${video.id}/comments`,
        { content: newComment.trim(), parent_id: replyTo?.id || null },
        { headers: getAuthHeaders() }
      );
      setNewComment('');
      setReplyTo(null);
      fetchComments();
    } catch (err) {
      toast.error('Erro ao publicar comentário');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await axios.delete(`${API_URL}/videos/${video.id}/comments/${commentId}`, {
        headers: getAuthHeaders()
      });
      fetchComments();
    } catch (err) {
      toast.error('Erro ao excluir comentário');
    }
  };

  const handleSubmitEval = async () => {
    if (!myRating) return;
    setSubmittingEval(true);
    try {
      await axios.post(`${API_URL}/videos/${video.id}/evaluations`,
        { score: myRating },
        { headers: getAuthHeaders() }
      );
      setSavedRating(myRating);
      toast.success('Avaliação enviada!');
    } catch (err) {
      toast.error('Erro ao enviar avaliação');
    } finally {
      setSubmittingEval(false);
    }
  };

  // ─── Comments tree ────────────────────────────────────────────────────────────

  const topComments = comments.filter(c => !c.parent_id);
  const getReplies = (commentId) => comments.filter(c => c.parent_id === commentId);

  const completedCount = allVideos.filter(v => progress[v.id]?.completed).length;
  const progressPercent = allVideos.length > 0 ? Math.round((completedCount / allVideos.length) * 100) : 0;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Breadcrumb header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="text-sm text-muted-foreground truncate">
          <span>{stage?.name}</span>
          <span className="mx-1">/</span>
          <span>{subcategory?.name}</span>
          <span className="mx-1">/</span>
          <span className="text-foreground font-medium truncate">{video.title}</span>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Player + Info + Comments ────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Video Player */}
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="aspect-video bg-black">
              {isEmbedded ? (
                <iframe
                  key={video.id}
                  src={getVideoSrc()}
                  className="w-full h-full"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              ) : (
                <video
                  key={video.id}
                  src={getVideoSrc()}
                  controls
                  autoPlay
                  className="w-full h-full"
                />
              )}
            </div>
          </Card>

          {/* Prev / Next navigation */}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={!prevVideo}
              onClick={() => prevVideo && onVideoChange(prevVideo)}
              className="flex-1 justify-start"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              <span className="truncate">{prevVideo ? prevVideo.title : 'Início'}</span>
            </Button>
            <Button
              variant="outline"
              disabled={!nextVideo}
              onClick={() => nextVideo && onVideoChange(nextVideo)}
              className="flex-1 justify-end"
            >
              <span className="truncate">{nextVideo ? nextVideo.title : 'Fim'}</span>
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Video info + actions */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-5 space-y-4">
              <div>
                <h1 className="text-xl font-bold">{video.title}</h1>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {video.category && <Badge variant="secondary">{video.category}</Badge>}
                  {video.duration && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDuration(video.duration)}
                    </span>
                  )}
                  {video.video_type === 'link' && (
                    <span className="flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5" /> Link externo
                    </span>
                  )}
                </div>
                {video.description && (
                  <p className="text-sm text-muted-foreground mt-3">{video.description}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-3 border-t">
                {/* Star rating */}
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center gap-1"
                    onMouseLeave={() => setHoverRating(0)}
                  >
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        disabled={submittingEval}
                        onMouseEnter={() => setHoverRating(star)}
                        onClick={() => setMyRating(star)}
                        className="cursor-pointer hover:scale-110 transition-transform disabled:cursor-default"
                      >
                        <Star
                          className={`w-5 h-5 transition-colors ${
                            star <= (hoverRating || myRating)
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-muted-foreground/30'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {myRating > 0 && myRating !== savedRating && (
                    <Button size="sm" onClick={handleSubmitEval} disabled={submittingEval}>
                      {submittingEval ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Avaliar'}
                    </Button>
                  )}
                  {savedRating > 0 && myRating === savedRating && (
                    <span className="text-xs text-muted-foreground">Avaliado</span>
                  )}
                </div>

                {/* Mark complete */}
                <Button
                  variant={isCompleted ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleMarkComplete}
                  disabled={marking}
                  className={isCompleted ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
                >
                  {marking ? (
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  ) : isCompleted ? (
                    <CheckCheck className="w-4 h-4 mr-1.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  )}
                  {isCompleted ? 'Concluído' : 'Marcar como concluído'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card className="border-0 shadow-md">
            <CardContent className="p-5 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comentários
                {comments.length > 0 && (
                  <Badge variant="secondary">{comments.length}</Badge>
                )}
              </h2>

              {/* Comment input */}
              <form onSubmit={handleSubmitComment} className="space-y-2">
                {replyTo && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded text-sm">
                    <CornerDownRight className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Respondendo a</span>
                    <span className="font-medium">{replyTo.user_name}</span>
                    <button
                      type="button"
                      onClick={() => setReplyTo(null)}
                      className="ml-auto text-muted-foreground hover:text-foreground"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    ref={commentInputRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={replyTo ? 'Escreva uma resposta...' : 'Escreva um comentário...'}
                    rows={2}
                    className="resize-none flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitComment(e);
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={submittingComment || !newComment.trim()}
                    className="self-end"
                  >
                    {submittingComment
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />
                    }
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Enter para enviar • Shift+Enter para nova linha</p>
              </form>

              {/* Comments list */}
              {commentsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : topComments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum comentário ainda. Seja o primeiro!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topComments.map((comment) => (
                    <div key={comment.id} className="space-y-2">
                      <CommentItem
                        comment={comment}
                        currentUserId={user?.id}
                        canManage={canManage}
                        onReply={(c) => {
                          setReplyTo(c);
                          commentInputRef.current?.focus();
                        }}
                        onDelete={handleDeleteComment}
                      />
                      {/* Replies */}
                      {getReplies(comment.id).map((reply) => (
                        <div key={reply.id} className="ml-8 pl-4 border-l-2 border-muted">
                          <CommentItem
                            comment={reply}
                            currentUserId={user?.id}
                            canManage={canManage}
                            onReply={(c) => {
                              setReplyTo(c);
                              commentInputRef.current?.focus();
                            }}
                            onDelete={handleDeleteComment}
                            isReply
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Playlist ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <Card className="border-0 shadow-md sticky top-4">
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b space-y-2">
                <h2 className="font-semibold text-sm">Playlist</h2>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{completedCount}/{allVideos.length} concluídas</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-1" />
                </div>
              </div>

              <ScrollArea className="h-[calc(100vh-320px)] min-h-[300px]">
                <div className="divide-y">
                  {allVideos.map((v, index) => {
                    const isCurrent = v.id === video.id;
                    const done = progress[v.id]?.completed;
                    return (
                      <button
                        key={v.id}
                        onClick={() => !isCurrent && onVideoChange(v)}
                        className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors ${isCurrent ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                      >
                        {/* Status */}
                        <div className="flex-shrink-0 mt-0.5">
                          {done ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : isCurrent ? (
                            <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                              <Play className="w-2 h-2 text-primary-foreground ml-0.5" />
                            </div>
                          ) : (
                            <Circle className="w-4 h-4 text-muted-foreground/40" />
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-medium line-clamp-2 ${isCurrent ? 'text-primary' : done ? 'text-muted-foreground' : ''}`}>
                            {index + 1}. {v.title}
                          </p>
                          {v.duration && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {formatDuration(v.duration)}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// ─── Comment Item Sub-component ────────────────────────────────────────────────

const CommentItem = ({ comment, currentUserId, canManage, onReply, onDelete, isReply = false }) => {
  const canDelete = canManage || comment.user_id === currentUserId;
  const initials = comment.user_name
    ? comment.user_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="flex gap-3 group">
      {/* Avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
        {comment.user_photo_url ? (
          <img src={comment.user_photo_url} alt={comment.user_name} className="w-full h-full rounded-full object-cover" />
        ) : initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{comment.user_name}</span>
          <span className="text-xs text-muted-foreground">{formatTimeAgo(comment.created_at)}</span>
        </div>
        <p className="text-sm mt-0.5 break-words">{comment.content}</p>
        <div className="flex items-center gap-2 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isReply && (
            <button
              onClick={() => onReply(comment)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <CornerDownRight className="w-3 h-3" />
              Responder
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-xs text-destructive/60 hover:text-destructive flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerView;
