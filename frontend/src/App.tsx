'use client';

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ChangeEvent, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, ArrowLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronDown, ChevronRight, CircleHelp, CloudUpload, FileAudio, Film, History, Image as ImageIcon, LayoutGrid, Link2, LoaderCircle, LockKeyhole, LogOut, Menu, Moon, Plus, RefreshCw, Send, Settings2, ShieldCheck, Sparkles, Sun, Trash2, TriangleAlert, X } from 'lucide-react';
import { api, getToken, setToken, type Platform, type Post, type TargetStatus } from './api';
import { fileWarning, PLATFORMS, PLATFORM_LIMITS, PLATFORM_NAMES, platformWarning } from './validation';

type Page = 'overview' | 'compose' | 'history' | 'channels' | 'settings';
const subtitles: Record<Platform, string> = { linkedin: 'Share with your professional network', facebook: 'Post to your Facebook Page', instagram: 'Share a post or Reel', youtube: 'Upload a video to your channel' };

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="brand"><span className="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M14.2 9.3 10 13.5a5 5 0 0 0 7.1 7.1l2.1-2.1M17.8 22.7l4.2-4.2a5 5 0 0 0-7.1-7.1l-2.1 2.1" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/><path d="m12.6 19.4 6.8-6.8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round"/></svg></span>{!compact && <span>Social<span className="brand-sync">Sync</span><span className="brand-dot">.</span></span>}</div>;
}

function PlatformIcon({ platform, small = false }: { platform: Platform; small?: boolean }) {
  return <span className={`platform-icon ${platform} ${small ? 'platform-icon-small' : ''}`} aria-hidden="true">{platform === 'linkedin' ? <span className="linkedin-glyph">in</span> : platform === 'facebook' ? <span className="facebook-glyph">f</span> : platform === 'instagram' ? <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" /><circle cx="17.6" cy="6.6" r="1.2" fill="currentColor" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 8.2a2.8 2.8 0 0 0-2-2C18.3 5.8 12 5.8 12 5.8s-6.3 0-8 .4a2.8 2.8 0 0 0-2 2 28 28 0 0 0 0 7.6 2.8 2.8 0 0 0 2 2c1.7.4 8 .4 8 .4s6.3 0 8-.4a2.8 2.8 0 0 0 2-2 28 28 0 0 0 0-7.6ZM10 15.2V8.8l5.5 3.2L10 15.2Z" /></svg>}</span>;
}

function Button({ children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props}>{children}</button>;
}

function StatusBadge({ status }: { status: TargetStatus }) {
  return <span className={`status-badge status-${status}`}><span className="status-dot" />{status === 'processing' ? 'Processing' : status.charAt(0).toUpperCase() + status.slice(1)}</span>;
}

function Login({ onLogin, previewMode }: { onLogin: () => void; previewMode: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try { const result = await api.login(username, password); setToken(result.access_token); onLogin(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to sign in.'); }
    finally { setBusy(false); }
  }
  return <div className="login-page"><div className="login-top"><Brand /><span className="login-top-note">One post. More possibilities.</span></div><div className="login-layout"><section className="login-intro"><div className="login-art"><span className="art-ring ring-one" /><span className="art-ring ring-two" /><span className="art-center"><Brand compact /></span><span className="art-platform art-one"><PlatformIcon platform="linkedin" /></span><span className="art-platform art-two"><PlatformIcon platform="instagram" /></span><span className="art-platform art-three"><PlatformIcon platform="facebook" /></span><span className="art-platform art-four"><PlatformIcon platform="youtube" /></span></div><span className="eyebrow">A LITTLE MORE SOCIAL</span><h1>One great idea.<br /><em>Everywhere.</em></h1><p>Your content deserves to be seen. Bring your channels together and share your story in a single click.</p><div className="login-proof"><span className="proof-check"><Check size={15} /></span> Made for creators who have places to be.</div></section><section className="login-card"><div className="login-card-top"><div className="tiny-logo"><LockKeyhole size={20} /></div><span>YOUR WORKSPACE</span></div><h2>Welcome back</h2><p>Sign in to your SocialSync workspace.</p><form onSubmit={submit}><label>Username<input autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username" required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required /></label>{error && <div className="form-error"><TriangleAlert size={16} />{error}</div>}<Button className="primary login-submit" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={17} /> : <>Sign in <ArrowRight size={17} /></>}</Button></form>{previewMode && <button className="text-link back-preview" onClick={onLogin}><ArrowLeft size={15} /> Return to demo workspace</button>}<div className="login-secure"><ShieldCheck size={15} /> Your workspace, safely in sync.</div></section></div><div className="login-footer">© {new Date().getFullYear()} SocialSync <span>Made for sharing good things.</span></div></div>;
}

function Sidebar({ page, setPage, onHelp, onLogout, mobileOpen, closeMobile }: { page: Page; setPage: (page: Page) => void; onHelp: () => void; onLogout: () => void; mobileOpen: boolean; closeMobile: () => void }) {
  const item = (id: Page, label: string, icon: ReactNode) => <button className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => { setPage(id); closeMobile(); }}>{icon}<span>{label}</span>{page === id && <span className="nav-active-dot" />}</button>;
  return <><div className={`sidebar-backdrop ${mobileOpen ? 'visible' : ''}`} onClick={closeMobile} /><aside className={`sidebar ${mobileOpen ? 'open' : ''}`}><div className="sidebar-logo"><Brand /><button className="mobile-close icon-button" onClick={closeMobile} aria-label="Close menu"><X size={19} /></button></div><div className="workspace-switch"><div className="workspace-avatar">S</div><div className="workspace-label"><strong>My workspace</strong><span>Personal workspace</span></div><ChevronDown size={15} /></div><div className="nav-label">WORKSPACE</div><nav className="nav-list" aria-label="Main navigation">{item('overview', 'Overview', <LayoutGrid size={18} />)}{item('compose', 'Create a post', <Plus size={19} />)}{item('history', 'Post history', <History size={18} />)}{item('channels', 'My channels', <Link2 size={18} />)}</nav><div className="nav-label channels-label">YOUR CHANNELS <button title="View channels" onClick={() => { setPage('channels'); closeMobile(); }}><Plus size={15} /></button></div><div className="sidebar-channels">{PLATFORMS.map(p => <button key={p} onClick={() => { setPage('channels'); closeMobile(); }}><PlatformIcon platform={p} small /><span>{PLATFORM_NAMES[p]}</span><span className="channel-dot" /></button>)}</div><div className="sidebar-bottom"><div className="help-card"><div className="help-spark"><Sparkles size={17} /></div><strong>A little help goes a long way.</strong><p>Get the most out of your SocialSync workspace.</p><button onClick={onHelp}>See how it works <ArrowRight size={13} /></button></div><button className={`nav-item settings-link ${page === 'settings' ? 'active' : ''}`} onClick={() => { setPage('settings'); closeMobile(); }}><Settings2 size={18} /><span>Settings</span></button><div className="sidebar-profile"><div className="profile-avatar">A</div><div className="profile-text"><strong>Workspace admin</strong><span>Personal account</span></div><button title="Sign out" aria-label="Sign out" className="profile-more" onClick={onLogout}><LogOut size={16} /></button></div></div></aside></>;
}

function Topbar({ page, dark, toggleTheme, openMenu }: { page: Page; dark: boolean; toggleTheme: () => void; openMenu: () => void }) {
  const names: Record<Page, string> = { overview: 'Overview', compose: 'Create a post', history: 'Post history', channels: 'My channels', settings: 'Settings' };
  return <header className="topbar"><div className="topbar-left"><button className="mobile-menu icon-button" onClick={openMenu} aria-label="Open menu"><Menu size={21} /></button><span className="crumb-muted">Workspace</span><ChevronRight size={15} className="crumb-divider" /><strong>{names[page]}</strong></div><div className="topbar-right"><span className="environment-pill"><span /> Workspace ready</span><span className="topbar-separator" /><button className="icon-button theme-button" onClick={toggleTheme} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} title={dark ? 'Light mode' : 'Dark mode'}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button><span className="top-avatar">A</span></div></header>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}

function StepBar() {
  return <div className="step-bar"><div className="step-item current"><span className="step-number">01</span><span><strong>Create your post</strong><small>Add your content</small></span></div><div className="step-line" /><div className="step-item"><span className="step-number">02</span><span><strong>Choose your channels</strong><small>Select where to share</small></span></div><div className="step-line" /><div className="step-item"><span className="step-number">03</span><span><strong>Publish everywhere</strong><small>We'll take it from here</small></span></div><div className="step-decoration"><Sparkles size={17} /></div></div>;
}

function Composer({ onPublished, notify }: { onPublished: () => void; notify: (message: string, kind?: 'success' | 'error') => void }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [selected, setSelected] = useState<Platform[]>([...PLATFORMS]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const warning = fileWarning(file);
  const warnings = selected.map(p => platformWarning(p, file, caption)).filter(Boolean);

  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  function chooseFile(chosen?: File) {
    if (!chosen) return;
    const issue = fileWarning(chosen);
    if (issue) { notify(issue, 'error'); return; }
    setFile(chosen);
  }
  function drop(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]); }
  function toggle(platform: Platform) { setSelected(previous => previous.includes(platform) ? previous.filter(p => p !== platform) : [...previous, platform]); }
  function reset() { setFile(null); setTitle(''); setCaption(''); setSelected([...PLATFORMS]); if (inputRef.current) inputRef.current.value = ''; }
  async function publish() {
    if (!file) return notify('Add a media file before publishing.', 'error');
    if (!title.trim()) return notify('Give your post a title first.', 'error');
    if (!caption.trim()) return notify('Add a caption before publishing.', 'error');
    if (!selected.length) return notify('Choose at least one platform.', 'error');
    if (warning || warnings.length) return notify(warning || warnings[0] || 'Check your post details.', 'error');
    setBusy(true);
    let mediaId = '';
    try {
      setProgress(file.name.toLowerCase().endsWith('.mp3') ? 'Uploading and converting audio…' : 'Uploading your media…');
      const media = await api.upload(file); mediaId = media.id;
      setProgress('Sending to your channels…');
      await api.createPost(title.trim(), caption, media.id, selected);
      await queryClient.invalidateQueries({ queryKey: ['posts'] });
      reset(); notify('Your post is on its way! Follow its progress in history.', 'success'); onPublished();
    } catch (err) {
      if (mediaId) await api.deleteMedia(mediaId).catch(() => undefined);
      notify(err instanceof Error ? err.message : 'Something went wrong. Please try again.', 'error');
    } finally { setBusy(false); setProgress(''); }
  }
  return <><PageHeading eyebrow="LET'S GET SHARING" title="Create a post" description="One great post, all your favorite places." action={<Button className="secondary" onClick={onPublished}><History size={16} /> View post history <ArrowRight size={15} /></Button>} /><StepBar /><div className="compose-grid"><section className="card compose-card"><div className="card-heading"><div className="heading-icon lavender"><FileAudio size={19} /></div><div><h2>Your content</h2><p>Let's start with something worth sharing.</p></div><span className="section-index">01</span></div><div className="card-divider" /><div className="field-title"><label>Media <span className="required">*</span></label><span>One file per post</span></div><input ref={inputRef} type="file" accept=".png,.mp4,.mp3,image/png,video/mp4,audio/mpeg" className="visually-hidden" onChange={(e: ChangeEvent<HTMLInputElement>) => chooseFile(e.target.files?.[0])} />{!file ? <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}><div className="upload-icon"><CloudUpload size={23} strokeWidth={1.8} /></div><strong>Drag and drop your file here</strong><p>or <span>browse files</span> from your computer</p><div className="file-types"><span>PNG</span><span>MP4</span><span>MP3</span><i />Up to 200 MB</div></div> : <div className="selected-file"><div className="selected-file-top"><div className="selected-file-icon">{file.type.startsWith('image/') ? <ImageIcon size={20} /> : file.type.startsWith('video/') ? <Film size={20} /> : <FileAudio size={20} />}</div><div className="selected-file-name"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to upload</span></div><button className="icon-button remove-file" aria-label="Remove file" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ''; }}><Trash2 size={17} /></button></div>{preview && (file.type.startsWith('image/') ? <img className="media-preview" src={preview} alt="Selected upload preview" /> : file.type.startsWith('video/') ? <video className="media-preview" src={preview} controls /> : <audio className="audio-preview" src={preview} controls />)}{file.name.toLowerCase().endsWith('.mp3') && <p className="audio-note"><Sparkles size={14} /> Your audio will be converted into a video with a cover image.</p>}</div>}<div className="form-field"><div className="field-title"><label htmlFor="post-title">Post title <span className="required">*</span></label><span>{title.length}/100</span></div><input id="post-title" maxLength={100} value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your post a title" /><p className="field-hint">A little context goes a long way.</p></div><div className="form-field caption-field"><div className="field-title"><label htmlFor="post-caption">Caption <span className="required">*</span></label><span>Make it memorable</span></div><textarea id="post-caption" value={caption} onChange={e => setCaption(e.target.value)} placeholder="What would you like to share with the world?" /><div className="caption-footer"><span><Sparkles size={14} /> Your voice, across every channel.</span><span>{caption.length.toLocaleString()} characters</span></div></div><div className="counter-block"><div className="counter-heading">CHARACTER LIMITS <span>per platform</span></div><div className="counter-list">{PLATFORMS.map(p => <div key={p} className={`counter-item ${caption.length > PLATFORM_LIMITS[p] ? 'over-limit' : ''}`}><PlatformIcon platform={p} small /><span>{caption.length.toLocaleString()} <i>/</i> {PLATFORM_LIMITS[p].toLocaleString()}</span></div>)}</div></div></section><aside className="compose-aside"><section className="card platforms-card"><div className="card-heading"><div className="heading-icon peach"><Send size={18} /></div><div><h2>Choose your channels</h2><p>Where should this post go?</p></div><span className="section-index">02</span></div><div className="card-divider" /><div className="platforms-top"><span>PLATFORMS <b>{selected.length}/4</b></span><button onClick={() => setSelected(selected.length === 4 ? [] : [...PLATFORMS])}>{selected.length === 4 ? 'Clear all' : 'Select all'}</button></div><div className="platform-list">{PLATFORMS.map(platform => { const checked = selected.includes(platform); const issue = checked ? platformWarning(platform, file, caption) : null; return <label className={`platform-row ${checked ? 'selected' : ''} ${issue ? 'has-warning' : ''}`} key={platform}><PlatformIcon platform={platform} /><span className="platform-copy"><strong>{PLATFORM_NAMES[platform]}</strong><small>{issue || subtitles[platform]}</small></span><span className="custom-check"><input type="checkbox" checked={checked} onChange={() => toggle(platform)} aria-label={`Publish to ${PLATFORM_NAMES[platform]}`} /><span>{checked && <Check size={13} strokeWidth={3} />}</span></span></label>; })}</div><div className="publish-area"><div className="publish-summary"><span><span className="summary-dot" /> Ready when you are</span><strong>{selected.length} {selected.length === 1 ? 'channel' : 'channels'} selected</strong></div><Button className="primary publish-button" onClick={publish} disabled={busy}>{busy ? <><LoaderCircle size={18} className="spin" /> {progress}</> : <><Send size={17} /> Publish post <ArrowRight size={17} /></>}</Button><p><ShieldCheck size={14} /> Your post is safe until you hit publish.</p></div></section><div className="tips-card"><div className="tips-icon"><Sparkles size={18} /></div><div><strong>One post, more possibilities.</strong><p>SocialSync handles the heavy lifting, so you can get back to creating.</p></div><span className="tips-star">✦</span></div><div className="secure-note"><ShieldCheck size={15} /> Dry run is on by default. <span>Publish with confidence.</span></div></aside></div></>;
}

function Stats({ posts }: { posts: Post[] }) {
  const values = [ { label: 'Total posts', value: posts.length, icon: <LayoutGrid size={18} />, tone: 'violet' }, { label: 'Published', value: posts.filter(p => p.status === 'published').length, icon: <CheckCircle2 size={18} />, tone: 'green' }, { label: 'In progress', value: posts.filter(p => p.status === 'pending' || p.status === 'processing').length, icon: <Activity size={18} />, tone: 'blue' }, { label: 'Needs attention', value: posts.filter(p => p.status === 'failed').length, icon: <TriangleAlert size={18} />, tone: 'orange' } ];
  return <div className="stats-grid">{values.map(v => <div className="card stat-card" key={v.label}><div className={`stat-icon ${v.tone}`}>{v.icon}</div><span>{v.label}</span><strong>{v.value}</strong></div>)}</div>;
}

function HistoryView({ posts, loading, error, refresh, retry, newPost }: { posts: Post[]; loading: boolean; error: string; refresh: () => void; retry: (id: string, platform: Platform) => void; newPost: () => void }) {
  return <><PageHeading eyebrow="YOUR CONTENT JOURNEY" title="Post history" description="Everything you've shared, all in one place." action={<Button className="primary heading-primary" onClick={newPost}><Plus size={17} /> Create a post</Button>} /><Stats posts={posts} /><div className="card history-card"><div className="history-heading"><div><h2>All posts <span>{posts.length}</span></h2><p>Keep an eye on how your content is doing.</p></div><Button className="secondary refresh-button" onClick={refresh}><RefreshCw size={15} /> Refresh</Button></div>{error && <div className="inline-error"><TriangleAlert size={16} /> {error}</div>}{loading ? <div className="empty-state"><LoaderCircle size={24} className="spin" /><p>Loading your posts…</p></div> : posts.length === 0 ? <div className="empty-state"><div className="empty-icon"><History size={24} /></div><h3>It's a little quiet here</h3><p>Your published posts and their progress will show up here.</p><Button className="secondary" onClick={newPost}><Plus size={16} /> Create your first post</Button></div> : <div className="table-wrap"><table><thead><tr><th>POST</th><th>CHANNELS & STATUS</th><th>OVERALL</th><th>CREATED</th></tr></thead><tbody>{posts.map(post => <tr key={post.id}><td><div className="post-title-cell"><div className="post-file-icon"><FileAudio size={17} /></div><div><strong>{post.title}</strong><span>{post.caption || 'No caption'}</span></div></div></td><td><div className="target-list">{post.targets.map(target => <div className="target-row" key={target.id}><PlatformIcon platform={target.platform} small /><span>{PLATFORM_NAMES[target.platform]}</span><StatusBadge status={target.status} />{target.status === 'failed' && <button className="retry-link" title={target.error || 'Retry this channel'} onClick={() => retry(post.id, target.platform)}><RefreshCw size={12} /> Retry</button>}{target.external_url && <a className="external-link" target="_blank" rel="noreferrer" href={target.external_url} title="Open published post"><ArrowUpRight size={14} /></a>}{target.error && <small className="target-error">{target.error}</small>}</div>)}</div></td><td><StatusBadge status={post.status} /></td><td className="date-cell">{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}<small>{new Date(post.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</small></td></tr>)}</tbody></table></div>}</div><p className="history-footnote"><Activity size={14} /> Posts in progress refresh automatically every 3 seconds.</p></>;
}

function Overview({ posts, newPost, viewHistory }: { posts: Post[]; newPost: () => void; viewHistory: () => void }) {
  return <><PageHeading eyebrow="WELCOME TO YOUR WORKSPACE" title="Hello, creator." description="A little more organized. A lot more social." action={<Button className="primary heading-primary" onClick={newPost}><Plus size={17} /> Create a post</Button>} /><div className="overview-hero"><div><span>YOUR CONTENT, SIMPLIFIED</span><h2>Good ideas deserve<br />to go everywhere.</h2><p>Create once, share to all your channels, and get back to doing what you love.</p><Button className="hero-button" onClick={newPost}>Create your first post <ArrowRight size={16} /></Button></div><div className="hero-art"><div className="hero-art-center"><Brand compact /></div>{PLATFORMS.map(p => <span key={p} className={`hero-platform hero-${p}`}><PlatformIcon platform={p} /></span>)}</div></div><div className="section-heading"><div><h2>Your workspace at a glance</h2><p>A quick look at your publishing activity.</p></div><button onClick={viewHistory}>View post history <ArrowRight size={15} /></button></div><Stats posts={posts} /><div className="card overview-bottom"><div className="heading-icon lavender"><Sparkles size={19} /></div><div><h3>Ready to make something great?</h3><p>Choose a file, write a caption, and we'll take care of the rest.</p></div><Button className="secondary" onClick={newPost}>Get started <ArrowRight size={15} /></Button></div></>;
}

function Channels() {
  return <><PageHeading eyebrow="BETTER TOGETHER" title="Your channels" description="All your favorite platforms, in one happy place." /><div className="channel-intro"><span className="heading-icon lavender"><Link2 size={20} /></span><div><strong>Four channels. One simple workflow.</strong><p>SocialSync supports these platforms. Real publishing credentials are configured securely on the server; dry run is enabled by default.</p></div></div><div className="channels-grid">{PLATFORMS.map(p => <div className="card channel-card" key={p}><div className="channel-card-top"><PlatformIcon platform={p} /><span className="available-pill"><Check size={12} /> Supported</span></div><h3>{PLATFORM_NAMES[p]}</h3><p>{subtitles[p]}. {p === 'youtube' ? 'Video and converted audio supported.' : p === 'instagram' ? 'Images and Reels supported.' : 'Share your images and videos.'}</p><span className="channel-config"><LockKeyhole size={14} /> Configured securely on the server</span></div>)}</div></>;
}

function Settings({ dark, toggleTheme, onLogout }: { dark: boolean; toggleTheme: () => void; onLogout: () => void }) {
  return <><PageHeading eyebrow="MAKE IT YOURS" title="Settings" description="A workspace that works the way you do." /><section className="card settings-card"><h2>Workspace preferences</h2><p>A few little things to make yourself at home.</p><div className="setting-row"><span className="heading-icon lavender">{dark ? <Moon size={19} /> : <Sun size={19} />}</span><div><strong>Appearance</strong><small>Switch between light and dark mode.</small></div><Button className="secondary" onClick={toggleTheme}>{dark ? 'Use light mode' : 'Use dark mode'}</Button></div><div className="setting-row"><span className="heading-icon peach"><LockKeyhole size={19} /></span><div><strong>Admin session</strong><small>Manage credentials through your environment configuration.</small></div><Button className="secondary" onClick={onLogout}>Sign out</Button></div></section></>;
}

function Workspace({ previewMode }: { previewMode: boolean }) {
  const queryClient = useQueryClient();
  const [authenticated, setAuthenticated] = useState(previewMode);
  const [checking, setChecking] = useState(!previewMode);
  const [page, setPage] = useState<Page>('compose');
  const [dark, setDark] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' } | null>(null);
  useEffect(() => { if (getToken()) setAuthenticated(true); setChecking(false); setDark(window.localStorage.getItem('socialsync_theme') === 'dark'); }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; window.localStorage.setItem('socialsync_theme', dark ? 'dark' : 'light'); }, [dark]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 5000); return () => window.clearTimeout(timer); }, [toast]);
  const postsQuery = useQuery({ queryKey: ['posts'], queryFn: api.posts, enabled: authenticated, refetchInterval: query => query.state.data?.some(post => post.targets.some(target => target.status === 'pending' || target.status === 'processing')) ? 3000 : false });
  const posts = postsQuery.data || [];
  const notify = (message: string, kind: 'success' | 'error' = 'success') => setToast({ message, kind });
  async function retry(id: string, platform: Platform) { try { await api.retry(id, platform); await queryClient.invalidateQueries({ queryKey: ['posts'] }); notify(`Retrying ${PLATFORM_NAMES[platform]}.`); } catch (err) { notify(err instanceof Error ? err.message : 'Could not retry.', 'error'); } }
  function logout() { setToken(null); setAuthenticated(false); queryClient.clear(); }
  if (checking) return <div className="loading-screen"><Brand /><LoaderCircle className="spin" size={22} /></div>;
  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} previewMode={previewMode} />;
  return <div className="app-shell"><Sidebar page={page} setPage={setPage} onHelp={() => setHelp(true)} onLogout={logout} mobileOpen={mobileOpen} closeMobile={() => setMobileOpen(false)} /><div className="main-shell"><Topbar page={page} dark={dark} toggleTheme={() => setDark(!dark)} openMenu={() => setMobileOpen(true)} /><main className="main-content">{page === 'compose' && <Composer onPublished={() => setPage('history')} notify={notify} />}{page === 'history' && <HistoryView posts={posts} loading={postsQuery.isLoading} error={postsQuery.error instanceof Error ? postsQuery.error.message : ''} refresh={() => void postsQuery.refetch()} retry={retry} newPost={() => setPage('compose')} />}{page === 'overview' && <Overview posts={posts} newPost={() => setPage('compose')} viewHistory={() => setPage('history')} />}{page === 'channels' && <Channels />}{page === 'settings' && <Settings dark={dark} toggleTheme={() => setDark(!dark)} onLogout={logout} />}<div className="content-footer"><span>Made for sharing good things <span className="footer-heart">♥</span></span><span>© {new Date().getFullYear()} SocialSync</span></div></main></div>{toast && <div className={`toast ${toast.kind}`} role="status">{toast.kind === 'success' ? <CheckCircle2 size={19} /> : <TriangleAlert size={19} />}<span>{toast.message}</span><button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={16} /></button></div>}{help && <div className="modal-backdrop" onClick={() => setHelp(false)}><div className="help-modal card" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button className="modal-close icon-button" aria-label="Close help" onClick={() => setHelp(false)}><X size={20} /></button><div className="heading-icon lavender"><CircleHelp size={21} /></div><h2 id="help-title">A little help, right here.</h2><p>Sharing everywhere is as easy as one, two, three.</p><div className="help-steps"><div><span>1</span><p><strong>Add your content</strong>Upload a PNG, MP4, or MP3 and write your caption.</p></div><div><span>2</span><p><strong>Pick your channels</strong>Choose where you'd like your post to appear.</p></div><div><span>3</span><p><strong>Publish and relax</strong>Follow each channel's progress in post history.</p></div></div><Button className="primary" onClick={() => { setHelp(false); setPage('compose'); }}>Got it <ArrowRight size={16} /></Button></div></div>}</div>;
}

export default function App({ previewMode = false }: { previewMode?: boolean }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }));
  return <QueryClientProvider client={client}><Workspace previewMode={previewMode} /></QueryClientProvider>;
}
