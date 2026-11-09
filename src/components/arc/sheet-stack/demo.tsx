"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Check, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "../button/button";
import SegmentedControl from "../segmented-control/segmented-control";
import { Switch } from "../switch/switch";
import { Input } from "../input/input";
import { avatar, photo, portrait } from "../lib/media";
import { motionTokens } from "../lib/motion-tokens";
import { Sheet, SheetStack, useSheetStack, type SheetStackMode } from "./sheet-stack";
import styles from "./sheet-stack.module.css";

export const meta = "Live · component";

interface Profile { name: string; role: string; photo: string | null }

const emma: Profile = { name: "Emma Collins", role: "Product designer", photo: avatar("emma-collins") };

const photos = [
  { src: avatar("emma-collins"), label: "Headshot" },
  { src: portrait("emma-collins"), label: "Portrait" },
  { src: photo("alpine-lake").src, label: "Alpine lake" },
  { src: photo("terracotta-waves").src, label: "Terracotta walls" },
  { src: photo("sea-at-dusk").src, label: "Sea at dusk" },
  { src: photo("lounge-chair").src, label: "Lounge chair" },
];

const intro = "Open settings, then drill into your profile and photo. Drag a sheet down or press Escape to go back a level.";

/** A round avatar that crossfades its face on a soft blur when the photo changes. */
function Portrait({ src, name, size }: { src: string | null; name: string; size: number }) {
  const reduced = useReducedMotion();
  return <span className={styles.avatar} style={{ width: size, height: size, fontSize: 0.36 * size }}>
    <AnimatePresence initial={false}>
      <motion.span
        key={src ?? "initials"}
        className={styles.avatarFace}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.08, filter: `blur(${motionTokens.blur.soft}px)` }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
        transition={reduced ? { duration: 0.15 } : motionTokens.spring.smooth}
      >
        {src ? <img src={src} alt="" /> : <span aria-hidden="true">{name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?"}</span>}
      </motion.span>
    </AnimatePresence>
  </span>;
}

function OpenSettings() {
  const { push } = useSheetStack();
  return <Button onClick={() => push("settings")}>Open settings</Button>;
}

function SettingsBody({ profile, onProfile, notify, setNotify, digest, setDigest }: {
  profile: Profile;
  onProfile: () => void;
  notify: boolean;
  setNotify: (on: boolean) => void;
  digest: boolean;
  setDigest: (on: boolean) => void;
}) {
  const { push } = useSheetStack();
  return <div className={styles.settings}>
    <button type="button" className={styles.profileRow} onClick={() => { onProfile(); push("profile"); }}>
      <Portrait src={profile.photo} name={profile.name} size={44} />
      <span className={styles.rowText}>
        <span className={styles.rowTitle}>{profile.name}</span>
        <span className={styles.rowMeta}>{profile.role}</span>
      </span>
      <ChevronRight className={styles.chevron} size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
    <div className={styles.group}>
      <div className={styles.switchRow}>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>Mentions</span>
          <span className={styles.rowMeta}>Notify me when someone tags me</span>
        </span>
        <Switch checked={notify} onCheckedChange={setNotify} aria-label="Mentions" />
      </div>
      <div className={styles.switchRow}>
        <span className={styles.rowText}>
          <span className={styles.rowTitle}>Weekly summary</span>
          <span className={styles.rowMeta}>An email every Monday at 9 a.m.</span>
        </span>
        <Switch checked={digest} onCheckedChange={setDigest} aria-label="Weekly summary" />
      </div>
    </div>
  </div>;
}

function ProfileBody({ draft, setDraft, onPhoto }: { draft: Profile; setDraft: (next: Profile) => void; onPhoto: () => void }) {
  const { push } = useSheetStack();
  return <div className={styles.profile}>
    <div className={styles.photoBlock}>
      <Portrait src={draft.photo} name={draft.name} size={76} />
      <button type="button" className={styles.textButton} onClick={() => { onPhoto(); push("photo"); }}>Change photo</button>
    </div>
    <Input label="Name" value={draft.name} autoComplete="name" onChange={event => setDraft({ ...draft, name: event.target.value })} />
    <Input label="Role" value={draft.role} onChange={event => setDraft({ ...draft, role: event.target.value })} />
  </div>;
}

function SaveFooter({ dirty, valid, onSave }: { dirty: boolean; valid: boolean; onSave: () => void }) {
  const { popTo } = useSheetStack();
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  return <Button
    disabled={state === "idle" && (!dirty || !valid)}
    loading={state === "saving"}
    onClick={() => {
      if (state !== "idle") return;
      setState("saving");
      timers.current.push(window.setTimeout(() => { onSave(); setState("saved"); }, 520));
      timers.current.push(window.setTimeout(() => { popTo("settings"); }, 1180));
    }}
  >
    {state === "saved" ? <><Check size={16} strokeWidth={2} aria-hidden="true" />Saved</> : "Save changes"}
  </Button>;
}

function PhotoBody({ pick, setPick }: { pick: string | null; setPick: (src: string | null) => void }) {
  const reduced = useReducedMotion();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = Math.max(0, photos.findIndex(entry => entry.src === pick));
  return <LayoutGroup id="sheet-stack-photos">
    <div className={styles.choices} role="radiogroup" aria-label="Profile photo">
      {photos.map((entry, index) => {
        const isSelected = entry.src === pick;
        return <button
          key={entry.src}
          ref={node => { buttons.current[index] = node; }}
          type="button"
          role="radio"
          aria-checked={isSelected}
          aria-label={entry.label}
          tabIndex={index === selected ? 0 : -1}
          className={styles.choice}
          data-selected={isSelected || undefined}
          onClick={() => setPick(entry.src)}
          onKeyDown={event => {
            const step = ({ ArrowRight: 1, ArrowDown: 3, ArrowLeft: -1, ArrowUp: -3 } as Record<string, number>)[event.key];
            if (!step) return;
            event.preventDefault();
            const next = (index + step + photos.length) % photos.length;
            setPick(photos[next].src);
            buttons.current[next]?.focus();
          }}
        >
          {isSelected && <motion.span layoutId="ring" className={styles.choiceRing} transition={reduced ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />}
          <img src={entry.src} alt="" />
        </button>;
      })}
    </div>
  </LayoutGroup>;
}

function PhotoFooter({ pick, onUse, onRemove }: { pick: string | null; onUse: () => void; onRemove: () => void }) {
  const { pop } = useSheetStack();
  return <>
    <Button variant="ghost" onClick={() => { onRemove(); pop(); }}>Remove photo</Button>
    <Button disabled={!pick} onClick={() => { onUse(); pop(); }}>Use photo</Button>
  </>;
}

export default function SheetStackDemo() {
  const reduced = useReducedMotion();
  const [mode, setMode] = useState<SheetStackMode>("auto");
  const [stack, setStack] = useState<string[]>([]);
  const [saved, setSaved] = useState<Profile>(emma);
  const [draft, setDraft] = useState<Profile>(emma);
  const [pick, setPick] = useState<string | null>(emma.photo);
  const [notify, setNotify] = useState(true);
  const [digest, setDigest] = useState(false);
  const [status, setStatus] = useState(intro);
  const dirty = draft.name !== saved.name || draft.role !== saved.role || draft.photo !== saved.photo;
  const pristine = saved === emma && notify && !digest && mode === "auto" && !stack.length;

  return <div className={styles.demo}>
    <div className={styles.stage}>
      <SheetStack
        contained
        mode={mode}
        stack={stack}
        onStackChange={next => {
          if (!next.length && stack.length) setStatus(dirty && stack.includes("profile") ? "Closed without saving. Your profile is unchanged." : "Settings closed.");
          setStack(next);
        }}
      >
        <div className={styles.account}>
          <Portrait src={saved.photo} name={saved.name} size={72} />
          <div className={styles.accountText}>
            <p className={styles.accountName}>{saved.name}</p>
            <p className={styles.accountMeta}>{saved.role}{" · Studio team"}</p>
          </div>
          <OpenSettings />
        </div>
        <Sheet id="settings" title="Settings">
          <SettingsBody
            profile={saved}
            onProfile={() => setDraft(saved)}
            notify={notify}
            setNotify={on => { setNotify(on); setStatus(on ? "Mention notifications are on." : "Mention notifications are off."); }}
            digest={digest}
            setDigest={on => { setDigest(on); setStatus(on ? "Weekly summary turned on for Mondays at 9 a.m." : "Weekly summary turned off."); }}
          />
        </Sheet>
        <Sheet
          id="profile"
          title="Edit profile"
          backLabel="Profile"
          footer={<SaveFooter
            dirty={dirty}
            valid={!!draft.name.trim()}
            onSave={() => {
              setSaved({ ...draft, name: draft.name.trim(), role: draft.role.trim() });
              setStatus("Profile saved. The settings row picked up the change.");
            }}
          />}
        >
          <ProfileBody draft={draft} setDraft={setDraft} onPhoto={() => setPick(draft.photo)} />
        </Sheet>
        <Sheet
          id="photo"
          title="Change photo"
          footer={<PhotoFooter
            pick={pick}
            onUse={() => { setDraft({ ...draft, photo: pick }); setStatus("New photo ready. Save changes to keep it."); }}
            onRemove={() => {
              setDraft({ ...draft, photo: null });
              setPick(null);
              setStatus("Photo removed. Initials show until you pick another.");
            }}
          />}
        >
          <PhotoBody pick={pick} setPick={setPick} />
        </Sheet>
      </SheetStack>
    </div>
    <div className={styles.demoFooter}>
      <p className={styles.srOnly} aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            className={styles.statusText}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 6, filter: `blur(${motionTokens.blur.subtle}px)` }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: 0.14 } }}
            transition={{ duration: 0.22, ease: [...motionTokens.ease.enter] }}
          >
            {status}
          </motion.span>
        </AnimatePresence>
      </p>
      <div className={styles.controls}>
        <SegmentedControl label="Layout" value={mode} onValueChange={value => setMode(value as SheetStackMode)} options={[
          { value: "auto", label: "Auto" },
          { value: "sheet", label: "Sheets" },
          { value: "dialog", label: "Dialogs" },
        ]} />
        <Button
          variant="secondary"
          disabled={pristine}
          onClick={() => {
            setStack([]);
            setSaved(emma);
            setDraft(emma);
            setPick(emma.photo);
            setNotify(true);
            setDigest(false);
            setMode("auto");
            setStatus("Reset to Emma’s original profile and settings.");
          }}
        >
          <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />Reset
        </Button>
      </div>
    </div>
  </div>;
}
