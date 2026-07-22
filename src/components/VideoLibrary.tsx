'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Video, Plus, X, Edit3, Trash2, Search, ExternalLink, Play, Clock, Film, Clapperboard, Tags } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useT } from '@/lib/i18n';
import type { VideoItem } from '@/lib/types';
import { useShallow } from '@/lib/useAppShallow';

const getYoutubeThumbnail = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://img.youtube.com/vi/${match[1]}/mqdefault.jpg` : null;
};

export default function VideoLibrary() {
  const {
    videoItems,
    addVideoItem,
    updateVideoItem,
    removeVideoItem,
    addToast,
    addNotification,
  } = useAppStore(useShallow((state) => ({
    videoItems: state.videoItems,
    addVideoItem: state.addVideoItem,
    updateVideoItem: state.updateVideoItem,
    removeVideoItem: state.removeVideoItem,
    addToast: state.addToast,
    addNotification: state.addNotification,
  })));
  const t = useT();

  const [showModal, setShowModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<VideoItem | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [url, setUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Extract unique categories from existing videos
  const categories = useMemo(() => {
    const cats = new Set<string>();
    videoItems.forEach((v) => {
      if (v.category.trim()) cats.add(v.category.trim());
    });
    return Array.from(cats);
  }, [videoItems]);

  // Filter videos by search and category
  const filteredVideos = useMemo(() => {
    return videoItems.filter((v) => {
      const matchesSearch = !searchQuery || v.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || v.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [videoItems, searchQuery, filterCategory]);

  const resetForm = () => {
    setName('');
    setCategory('');
    setUrl('');
    setDuration('');
    setDescription('');
    setEditingVideo(null);
    setError('');
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (video: VideoItem) => {
    setEditingVideo(video);
    setName(video.name);
    setCategory(video.category);
    setUrl(video.url);
    setDuration(video.duration);
    setDescription(video.description);
    setError('');
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('video.requiredName'));
      return;
    }
    if (url.trim() && !/^https?:\/\/.+/.test(url.trim())) {
      setError(t('video.invalidUrl'));
      return;
    }

    if (editingVideo) {
      const updated: VideoItem = {
        ...editingVideo,
        name: name.trim(),
        category: category.trim(),
        url: url.trim(),
        duration: duration.trim(),
        description: description.trim(),
      };
      updateVideoItem(updated);
      addToast(t('video.updateSuccess'), 'success');
    } else {
      const newVideo: VideoItem = {
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        name: name.trim(),
        category: category.trim(),
        url: url.trim(),
        duration: duration.trim(),
        description: description.trim(),
        createdAt: new Date().toISOString(),
      };
      addVideoItem(newVideo);
      addToast(t('video.addSuccess'), 'success');
      addNotification({
        id: Date.now().toString() + Math.random().toString(36).slice(2),
        title: t('notif.newVideo'),
        message: t('notif.newVideoDesc'),
        type: 'video',
        read: false,
        createdAt: new Date().toISOString(),
      });
    }

    setShowModal(false);
    resetForm();
  };

  const handleDelete = (video: VideoItem) => {
    if (confirm(t('video.deleteConfirm'))) {
      removeVideoItem(video.id);
      addToast(t('video.deleteSuccess'), 'success');
    }
  };

  const handleWatch = (videoUrl: string) => {
    window.open(videoUrl, '_blank', 'noopener,noreferrer');
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="sabeel-page-enter w-full">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="ps-14 md:ps-0">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><Clapperboard size={22} /></span><div><h1 className="text-2xl font-black text-slate-900 dark:text-white">{t('video.title')}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t('video.subtitle')}</p></div></div>
        </div>
        <div className="flex items-center gap-3">
          {videoItems.length > 0 && (
            <span className="text-sm text-gray-400 dark:text-gray-500">
              {filteredVideos.length} {t('video.videosCount')}
            </span>
          )}
          <button
            onClick={openAddModal}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 focus-visible:ring-4 focus-visible:ring-blue-500/20 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            <Plus size={18} />
            {t('video.addVideo')}
          </button>
        </div>
      </div>

      {videoItems.length > 0 && <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10"><Video size={20} /></span><div><p className="text-2xl font-black text-slate-900 dark:text-white">{videoItems.length}</p><p className="text-xs text-slate-500">{t('video.videosCount')}</p></div></article>
        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Play size={20} /></span><div><p className="text-2xl font-black text-slate-900 dark:text-white">{videoItems.filter((item) => Boolean(item.url)).length}</p><p className="text-xs text-slate-500">{t('video.watch')}</p></div></article>
        <article className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10"><Tags size={20} /></span><div><p className="text-2xl font-black text-slate-900 dark:text-white">{categories.length}</p><p className="text-xs text-slate-500">{t('video.category')}</p></div></article>
      </div>}

      {videoItems.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-12 text-center">
          <Video size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-400 dark:text-gray-500">{t('video.noVideos')}</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('video.emptyHint')}</p>
          <button
            onClick={openAddModal}
            className="mt-4 px-4 py-2 bg-slate-800 dark:bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} className="inline ml-1" />
            {t('video.addVideo')}
          </button>
        </div>
      ) : (
        <>
          {/* Search & Filter */}
          <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#26334a] dark:bg-[#111a2a] sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="absolute top-1/2 -translate-y-1/2 right-3 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('video.search')}
                className="w-full pr-9 pl-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </div>
            {categories.length > 0 && (
              <div className="flex gap-1 bg-gray-100 dark:bg-slate-700 rounded-lg p-0.5 overflow-x-auto">
                <button
                  onClick={() => setFilterCategory('all')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    filterCategory === 'all'
                      ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {t('video.filterAll')}
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(cat)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                      filterCategory === cat
                        ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm'
                        : 'text-gray-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Videos Grid */}
          {filteredVideos.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-12 text-center">
              <Search size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-400 dark:text-gray-500">{t('video.noVideos')}</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredVideos.map((video) => {
                  const thumbnail = getYoutubeThumbnail(video.url);
                  return (
                    <article
                      key={video.id}
                      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-blue-300 hover:shadow-md dark:border-[#26334a] dark:bg-[#111a2a]"
                    >
                      {/* Thumbnail */}
                      <div className="relative h-52 overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900">
                        {thumbnail ? (
                          <Image
                            src={thumbnail}
                            alt={video.name}
                            fill
                            sizes="(min-width: 1536px) 30vw, (min-width: 768px) 50vw, 100vw"
                            unoptimized
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-900">
                            <Film size={40} className="text-slate-400 dark:text-slate-500" />
                          </div>
                        )}
                        {/* Play overlay */}
                        {video.url && (
                          <div
                            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/40 transition-colors cursor-pointer"
                            onClick={() => handleWatch(video.url)}
                          >
                            <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-slate-800/90 flex items-center justify-center shadow-lg">
                              <Play size={20} className="text-slate-800 dark:text-white ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                        )}
                        {/* Duration badge */}
                        {video.duration && (
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-md bg-black/70 text-white text-[10px] font-medium">
                            <Clock size={10} />
                            {video.duration}
                          </div>
                        )}
                      </div>

                      {/* Card Body */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm line-clamp-2 flex-1">
                            {video.name}
                          </h3>
                        </div>

                        {video.category && (
                          <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 mb-2">
                            {video.category}
                          </span>
                        )}

                        {video.description && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 line-clamp-2 mb-3">
                            {video.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {t('video.createdAt')} {formatDate(video.createdAt)}
                          </span>
                          <div className="flex gap-1">
                            {video.url && (
                              <button
                                onClick={() => handleWatch(video.url)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                title={t('video.watch')}
                              >
                                <ExternalLink size={13} className="text-blue-500 dark:text-blue-400" />
                              </button>
                            )}
                            <button
                              onClick={() => openEditModal(video)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <Edit3 size={13} className="text-gray-400 dark:text-gray-500" />
                            </button>
                            <button
                              onClick={() => handleDelete(video)}
                              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                            >
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* Add / Edit Modal */}
        {showModal && (
          <div
            className="global-modal-overlay"
            onClick={() => setShowModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="global-modal-panel max-h-[90vh] w-full max-w-md overflow-y-auto p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {editingVideo ? t('video.editVideo') : t('video.addVideoTitle')}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
                >
                  <X size={18} className="text-gray-400 dark:text-gray-500" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                    {t('video.name')}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(''); }}
                    placeholder={t('video.namePlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                    {t('video.category')}
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder={t('video.categoryPlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* URL */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                    {t('video.url')}
                  </label>
                  <input
                    type="text"
                    value={url}
                    onChange={(e) => { setUrl(e.target.value); setError(''); }}
                    placeholder={t('video.urlPlaceholder')}
                    dir="ltr"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-slate-800 dark:text-slate-100 text-left"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                    {t('video.duration')}
                  </label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder={t('video.durationPlaceholder')}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-slate-800 dark:text-slate-100"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                    {t('video.description')}
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('video.descPlaceholder')}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 text-slate-800 dark:text-slate-100 resize-none"
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-slate-800 dark:bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-blue-700 transition-colors"
                  >
                    {editingVideo ? t('video.editVideo') : t('video.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    {t('proj.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </div>
  );
}
