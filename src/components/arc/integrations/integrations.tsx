"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { Variants } from "motion/react";
import { Eye, PenLine, Plus, RefreshCw, Unplug } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "../avatar/avatar";
import { Button } from "../button/button";
import { Drawer, DrawerContent } from "../drawer/drawer";
import { HoldToConfirm } from "../hold-to-confirm/hold-to-confirm";
import { SearchField } from "../search-field/search-field";
import { Select } from "../select/select";
import { motionTokens } from "../lib/motion-tokens";
import styles from "./integrations.module.css";

/**
 * An integrations directory where Connect morphs to Connected and the filters recount as you go.
 *
 * Use this on a settings or marketplace page. Load integrations and connection state from your API,
 * start each provider's OAuth flow from Connect, and save sync frequency and Disconnect through it;
 * every connection in the preview is simulated.
 */
export type IntegrationCategory = "communication" | "storage" | "analytics";
export type IntegrationFrequency = "realtime" | "15m" | "hourly" | "daily";
export type IntegrationStatus = "idle" | "connecting" | "connected";
export type AccessKind = "read" | "write" | "sync";

export interface IntegrationAccess {
  kind: AccessKind;
  text: string;
}

export interface IntegrationOwner {
  name: string;
  photo?: string;
  when: string;
}

export interface IntegrationItem {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  frequency: IntegrationFrequency;
  owner?: IntegrationOwner;
  access: IntegrationAccess[];
}

export interface IntegrationConnection {
  status: IntegrationStatus;
  frequency: IntegrationFrequency;
  owner: IntegrationOwner | null;
}

interface MarkShape {
  color: string;
  darkInk: boolean;
  d: string;
  viewBox?: string;
  layers?: { fill: string; d: string }[];
}

const MARKS: Record<string, MarkShape> = {
        slack: {
          color: "#4A154B",
          darkInk: false,
          d: "",
          viewBox: "0 0 24 24",
          layers: [
            {
              fill: "#E01E5A",
              d: "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z",
            },
            {
              fill: "#36C5F0",
              d: "M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z",
            },
            {
              fill: "#2EB67D",
              d: "M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312z",
            },
            {
              fill: "#ECB22E",
              d: "M15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z",
            },
          ],
        },
        "google-drive": {
          color: "#4285F4",
          darkInk: false,
          d: "",
          viewBox: "0 0 87.3 78",
          layers: [
            {
              fill: "#0066DA",
              d: "m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z",
            },
            {
              fill: "#00AC47",
              d: "m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z",
            },
            {
              fill: "#EA4335",
              d: "m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z",
            },
            {
              fill: "#00832D",
              d: "m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z",
            },
            {
              fill: "#2684FC",
              d: "m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z",
            },
            {
              fill: "#FFBA00",
              d: "m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z",
            },
          ],
        },
        mixpanel: {
          color: "#7856FF",
          darkInk: false,
          d: "M6.967 9.996h3.053c-.763-.477-1.048-1.145-1.431-2.384L7.443 3.366C6.919 1.458 6.49.551 4.39.551H.004v1.145h.621c1.286 0 1.431.477 1.814 1.908L3.44 7.326c.524 1.814 1.337 2.67 3.53 2.67h-.003Zm7.06 0h3.053c2.194 0 2.956-.86 3.484-2.67l1.001-3.722c.382-1.431.57-1.908 1.814-1.908H24V.551h-4.34c-2.146 0-2.576.86-3.053 2.815l-1.145 4.246c-.384 1.286-.673 1.907-1.435 2.384Zm-4.007 4.008h4.007V9.996H10.02v4.008ZM0 23.449h4.39c2.1 0 2.529-.907 3.053-2.815l1.146-4.246c.383-1.239.668-1.907 1.431-2.384H6.967c-2.194 0-3.007.86-3.531 2.67l-1.001 3.722c-.383 1.431-.524 1.907-1.814 1.907H0v1.146Zm19.65 0h4.343v-1.146h-.622c-1.239 0-1.431-.476-1.814-1.907l-1.001-3.722c-.524-1.814-1.286-2.67-3.483-2.67h-3.046c.762.477 1.041 1.098 1.424 2.384l1.145 4.246c.477 1.955.907 2.815 3.054 2.815Z",
        },
        gmail: {
          color: "#EA4335",
          darkInk: false,
          d: "M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z",
        },
        dropbox: {
          color: "#0061FF",
          darkInk: false,
          d: "M6 1.807L0 5.629l6 3.822 6.001-3.822L6 1.807zM18 1.807l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6.001-3.822L6 9.452l-6 3.822zM18 9.452l-6 3.822 6 3.822 6-3.822-6-3.822zM6 18.371l6.001 3.822 6-3.822-6-3.822L6 18.371z",
        },
        "google-analytics": {
          color: "#E37400",
          darkInk: false,
          d: "M22.84 2.9982v17.9987c.0086 1.6473-1.3197 2.9897-2.967 2.9984a2.9808 2.9808 0 01-.3677-.0208c-1.528-.226-2.6477-1.5558-2.6105-3.1V3.1204c-.0369-1.5458 1.0856-2.8762 2.6157-3.1 1.6361-.1915 3.1178.9796 3.3093 2.6158.014.1201.0208.241.0202.3619zM4.1326 18.0548c-1.6417 0-2.9726 1.331-2.9726 2.9726C1.16 22.6691 2.4909 24 4.1326 24s2.9726-1.3309 2.9726-2.9726-1.331-2.9726-2.9726-2.9726zm7.8728-9.0098c-.0171 0-.0342 0-.0513.0003-1.6495.0904-2.9293 1.474-2.891 3.1256v7.9846c0 2.167.9535 3.4825 2.3505 3.763 1.6118.3266 3.1832-.7152 3.5098-2.327.04-.1974.06-.3983.0593-.5998v-8.9585c.003-1.6474-1.33-2.9852-2.9773-2.9882z",
        },
        zoom: {
          color: "#0B5CFF",
          darkInk: false,
          d: "M5.033 14.649H.743a.74.74 0 0 1-.686-.458.74.74 0 0 1 .16-.808L3.19 10.41H1.06A1.06 1.06 0 0 1 0 9.35h3.957c.301 0 .57.18.686.458a.74.74 0 0 1-.161.808L1.51 13.59h2.464c.585 0 1.06.475 1.06 1.06zM24 11.338c0-1.14-.927-2.066-2.066-2.066-.61 0-1.158.265-1.537.686a2.061 2.061 0 0 0-1.536-.686c-1.14 0-2.066.926-2.066 2.066v3.311a1.06 1.06 0 0 0 1.06-1.06v-2.251a1.004 1.004 0 0 1 2.013 0v2.251c0 .586.474 1.06 1.06 1.06v-3.311a1.004 1.004 0 0 1 2.012 0v2.251c0 .586.475 1.06 1.06 1.06zM16.265 12a2.728 2.728 0 1 1-5.457 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0zm-4.82 0a2.728 2.728 0 1 1-5.458 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0z",
        },
        "amazon-s3": {
          color: "#569A31",
          darkInk: false,
          d: "M20.913 13.147l.12-.895c.947.576 1.258.922 1.354 1.071-.16.031-.562.046-1.474-.176zm-2.174 7.988a.547.547 0 0 0-.005.073c0 .084-.207.405-1.124.768a10.28 10.28 0 0 1-1.438.432c-1.405.325-3.128.504-4.853.504-4.612 0-7.412-1.184-7.412-1.704a.547.547 0 0 0-.005-.073L1.81 5.602c.135.078.28.154.432.227.042.02.086.038.128.057.134.062.272.122.417.18l.179.069c.154.058.314.114.478.168.043.013.084.029.13.043.207.065.423.127.646.187l.176.044c.175.044.353.087.534.127a23.414 23.414 0 0 0 .843.17l.121.023c.252.045.508.085.768.122.071.011.144.02.216.03.2.027.4.053.604.077l.24.027c.245.026.49.05.74.07l.081.009c.275.022.552.04.83.056l.233.012c.21.01.422.018.633.025a33.088 33.088 0 0 0 2.795-.026l.232-.011c.278-.016.555-.034.83-.056l.08-.008c.25-.02.497-.045.742-.072l.238-.026c.205-.024.408-.05.609-.077.07-.01.141-.019.211-.03.261-.037.519-.078.772-.122l.111-.02c.215-.04.427-.082.634-.125l.212-.047c.186-.041.368-.085.546-.13l.166-.042c.225-.06.444-.122.654-.189.04-.012.077-.026.115-.038a10.6 10.6 0 0 0 .493-.173c.058-.021.114-.044.17-.066.15-.06.293-.12.43-.185.038-.017.079-.034.116-.052.153-.073.3-.15.436-.228l-.976 7.245c-2.488-.78-5.805-2.292-7.311-3a1.09 1.09 0 0 0-1.088-1.085c-.6 0-1.088.489-1.088 1.088 0 .6.488 1.089 1.088 1.089.196 0 .378-.056.537-.148 1.72.812 5.144 2.367 7.715 3.15zm-7.42-20.047c5.677 0 9.676 1.759 9.75 2.736l-.014.113c-.01.033-.031.067-.048.101-.015.028-.026.057-.047.087-.024.033-.058.068-.09.102-.028.03-.051.06-.084.09-.038.035-.087.07-.133.105-.04.03-.074.06-.119.091-.053.036-.116.071-.177.107-.05.03-.095.06-.15.09-.068.036-.147.073-.222.11-.059.028-.114.057-.177.085-.084.038-.177.074-.268.111-.068.027-.13.054-.203.082-.097.036-.205.072-.31.107-.075.026-.148.053-.228.079-.111.035-.233.069-.35.103-.085.024-.165.05-.253.073-.124.034-.258.065-.389.098-.093.022-.181.046-.278.068-.139.032-.287.061-.433.091-.098.02-.191.041-.293.06-.155.03-.32.057-.482.084-.1.018-.198.036-.302.052-.166.026-.342.048-.515.072-.11.014-.213.03-.325.044-.181.023-.372.041-.56.06-.11.012-.218.025-.332.036-.188.016-.386.029-.58.043-.122.009-.24.02-.364.028-.207.012-.422.02-.635.028-.12.005-.234.012-.354.016a35.605 35.605 0 0 1-2.069 0c-.12-.004-.234-.011-.352-.016-.214-.008-.43-.016-.637-.028-.122-.008-.238-.02-.36-.027-.195-.015-.394-.028-.584-.044-.11-.01-.215-.024-.324-.035-.19-.02-.384-.038-.568-.06l-.315-.044c-.176-.024-.355-.046-.525-.073-.1-.015-.192-.033-.29-.05-.167-.028-.335-.055-.494-.086-.096-.018-.183-.038-.276-.056-.151-.032-.305-.062-.45-.095-.09-.02-.173-.043-.26-.064-.138-.034-.277-.067-.407-.102-.082-.022-.157-.046-.235-.069a11.75 11.75 0 0 1-.368-.108c-.075-.024-.141-.049-.213-.073-.11-.037-.223-.075-.325-.113-.067-.025-.125-.051-.188-.077-.096-.038-.195-.076-.282-.115-.06-.027-.11-.054-.166-.08-.08-.039-.162-.077-.233-.116-.052-.028-.094-.055-.142-.084-.063-.038-.13-.075-.185-.113-.043-.029-.075-.058-.113-.086-.048-.037-.098-.073-.139-.11-.032-.029-.054-.057-.08-.087-.033-.035-.069-.07-.093-.104-.02-.03-.031-.058-.046-.086-.018-.035-.039-.068-.049-.102l-.015-.113c.076-.977 4.074-2.736 9.748-2.736zm12.182 12.124c-.118-.628-.84-1.291-2.31-2.128l.963-7.16a.531.531 0 0 0 .005-.073C22.16 1.581 16.447 0 11.32 0 6.194 0 .482 1.581.482 3.851a.58.58 0 0 0 .005.072L2.819 21.25c.071 2.002 5.236 2.75 8.5 2.75 1.805 0 3.615-.188 5.098-.531.598-.138 1.133-.3 1.592-.48 1.18-.467 1.789-1.053 1.813-1.739l.945-7.018c.557.131 1.016.197 1.389.197.54 0 .902-.137 1.134-.413a.956.956 0 0 0 .21-.804Z",
        },
        snowflake: {
          color: "#29B5E8",
          darkInk: false,
          d: "M24 3.459c0 .646-.418 1.18-1.141 1.18-.723 0-1.142-.534-1.142-1.18 0-.647.419-1.18 1.142-1.18.723 0 1.141.533 1.141 1.18zm-.228 0c0-.533-.38-.951-.913-.951s-.913.38-.913.95c0 .533.38.952.913.952.57 0 .913-.419.913-.951zm-1.37-.533h.495c.266 0 .456.152.456.38 0 .153-.076.229-.19.305l.19.266v.038h-.266l-.19-.266h-.229v.266h-.266zm.495.228h-.229v.267h.229c.114 0 .152-.038.152-.114.038-.077-.038-.153-.152-.153zM7.602 12.4c.038-.151.076-.304.076-.456 0-.114-.038-.228-.038-.342-.114-.343-.304-.647-.646-.838l-4.87-2.777c-.685-.38-1.56-.152-1.94.533-.381.685-.153 1.56.532 1.94l2.701 1.56-2.701 1.56c-.685.38-.913 1.256-.533 1.94.38.685 1.256.914 1.94.533l4.832-2.777c.343-.267.571-.533.647-.876zm1.332 2.626c-.266-.038-.57.038-.837.19l-4.832 2.777c-.685.38-.913 1.256-.532 1.94.38.686 1.255.914 1.94.533l2.701-1.56v3.12c0 .8.647 1.408 1.446 1.408.799 0 1.407-.647 1.407-1.408v-5.592c0-.761-.57-1.37-1.293-1.408zm4.946-6.088c.266.038.57-.038.837-.19l4.832-2.777c.685-.38.913-1.256.532-1.94-.38-.686-1.255-.914-1.94-.533l-2.701 1.56V1.975c0-.799-.647-1.408-1.446-1.408-.799 0-1.446.609-1.446 1.408V7.53c0 .76.609 1.37 1.332 1.407zM3.265 5.97l4.832 2.777c.266.152.533.19.837.19.723-.038 1.331-.684 1.331-1.407V1.975c0-.799-.646-1.408-1.407-1.408-.799 0-1.446.647-1.446 1.408v3.12l-2.701-1.56c-.685-.38-1.56-.152-1.94.533-.419.646-.19 1.521.494 1.902zm9.093 6.011a.412.412 0 00-.114-.266l-.57-.571a.346.346 0 00-.267-.114.412.412 0 00-.266.114l-.571.57a.411.411 0 00-.114.267c0 .076.038.19.114.267l.57.57a.345.345 0 00.267.114c.076 0 .19-.038.266-.114l.571-.57a.412.412 0 00.114-.267zm1.598.533L11.94 14.53c-.039.038-.153.114-.229.114h-.608a.411.411 0 01-.267-.114L8.82 12.514a.408.408 0 01-.076-.229v-.608c0-.076.038-.19.114-.267l2.016-2.016a.41.41 0 01.267-.114h.608a.41.41 0 01.267.114l2.016 2.016a.347.347 0 01.114.267v.608c-.076.077-.114.19-.19.229zm5.593 5.44l-4.832-2.777c-.266-.152-.57-.19-.837-.152-.723.038-1.332.684-1.332 1.408v5.554c0 .8.647 1.408 1.408 1.408.799 0 1.446-.647 1.446-1.408v-3.12l2.7 1.56c.686.38 1.561.152 1.941-.533.419-.646.19-1.521-.494-1.94zm2.549-7.533l-2.701 1.56 2.7 1.56c.686.38.914 1.256.533 1.94-.38.685-1.255.913-1.94.533l-4.832-2.778a1.644 1.644 0 01-.647-.798c-.037-.153-.076-.305-.076-.457 0-.114.039-.228.039-.342.114-.343.342-.647.646-.837l4.832-2.778c.685-.38 1.56-.152 1.94.533.457.609.19 1.484-.494 1.864",
        },
      };

const INTEGRATIONS: IntegrationItem[] = [
          {
            id: "slack",
            name: "Slack",
            category: "communication",
            description:
              "Post release notes and approval requests to the channels you pick.",
            frequency: "realtime",
            owner: {
              name: "Emma Collins",
              photo: "/media/people/emma-collins.svg",
              when: "Sep 3",
            },
            access: [
              { kind: "read", text: "Read channel names and member lists" },
              {
                kind: "write",
                text: "Post and update messages in channels you choose",
              },
              {
                kind: "sync",
                text: "Unfurl project links shared in conversations",
              },
            ],
          },
          {
            id: "google-drive",
            name: "Google Drive",
            category: "storage",
            description:
              "Attach docs and keep shared folders in step with their projects.",
            frequency: "15m",
            owner: {
              name: "Marcus Johnson",
              photo: "/media/people/marcus-johnson.svg",
              when: "Aug 28",
            },
            access: [
              {
                kind: "read",
                text: "View files in folders shared with the workspace",
              },
              { kind: "write", text: "Create a folder for each new project" },
              {
                kind: "sync",
                text: "Mirror folder changes into project files",
              },
            ],
          },
          {
            id: "mixpanel",
            name: "Mixpanel",
            category: "analytics",
            description:
              "Send product events and funnels to Mixpanel as they happen.",
            frequency: "realtime",
            access: [
              { kind: "read", text: "Read the tracking plan and event schema" },
              {
                kind: "write",
                text: "Send workspace events to one Segment source",
              },
              {
                kind: "sync",
                text: "Replay the last 7 days of events after reconnecting",
              },
            ],
          },
          {
            id: "gmail",
            name: "Gmail",
            category: "communication",
            description:
              "Turn customer emails into tracked requests with the thread attached.",
            frequency: "15m",
            access: [
              {
                kind: "read",
                text: "Read messages sent to shared inboxes you pick",
              },
              {
                kind: "write",
                text: "Apply a label when a request is resolved",
              },
              { kind: "sync", text: "Import attachments up to 25 MB" },
            ],
          },
          {
            id: "dropbox",
            name: "Dropbox",
            category: "storage",
            description:
              "Link team folders to projects without uploading files twice.",
            frequency: "hourly",
            access: [
              { kind: "read", text: "View the files and folders you select" },
              { kind: "write", text: "Add a comment when a file is approved" },
              {
                kind: "sync",
                text: "Keep file versions and previews up to date",
              },
            ],
          },
          {
            id: "google-analytics",
            name: "Google Analytics",
            category: "analytics",
            description:
              "Track sign-ups and traffic on your public project pages.",
            frequency: "hourly",
            access: [
              {
                kind: "read",
                text: "Read saved cohorts to target announcements",
              },
              {
                kind: "write",
                text: "Create an annotation when a release ships",
              },
              { kind: "sync", text: "Send account and user properties" },
            ],
          },
          {
            id: "zoom",
            name: "Zoom",
            category: "communication",
            description:
              "Attach recordings and transcripts to the meetings on each project.",
            frequency: "hourly",
            access: [
              {
                kind: "read",
                text: "Read scheduled meetings and participants",
              },
              {
                kind: "write",
                text: "Create meeting links from project events",
              },
              { kind: "sync", text: "Import cloud recordings and transcripts" },
            ],
          },
          {
            id: "amazon-s3",
            name: "Amazon S3",
            category: "storage",
            description:
              "Archive nightly exports and audit logs to a bucket you own.",
            frequency: "daily",
            access: [
              {
                kind: "read",
                text: "List objects under the northwind/ prefix",
              },
              {
                kind: "write",
                text: "Write nightly exports to the bucket you choose",
              },
              { kind: "sync", text: "Keep 13 months of daily exports" },
            ],
          },
          {
            id: "snowflake",
            name: "Snowflake",
            category: "analytics",
            description:
              "Sync projects, tasks, and time entries to your warehouse every night.",
            frequency: "daily",
            access: [
              { kind: "read", text: "Read table sizes to estimate sync time" },
              { kind: "write", text: "Create tables in the schema you choose" },
              {
                kind: "sync",
                text: "Write incremental updates to those tables",
              },
            ],
          },
        ];

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  communication: "Communication",
  storage: "Storage",
  analytics: "Analytics",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "connected", label: "Connected" },
  { value: "communication", label: "Communication" },
  { value: "storage", label: "Storage" },
  { value: "analytics", label: "Analytics" },
];

const FREQUENCIES = [
  { value: "realtime", label: "Real time" },
  { value: "15m", label: "Every 15 minutes" },
  { value: "hourly", label: "Every hour" },
  { value: "daily", label: "Once a day" },
];

const FREQUENCY_HINTS: Record<IntegrationFrequency, string> = {
  realtime: "Changes arrive within a few seconds.",
  "15m": "Changes arrive in batches every 15 minutes.",
  hourly: "Runs at the start of every hour.",
  daily: "Runs once a day at 02:00 UTC.",
};

const FREQUENCY_PHRASES: Record<IntegrationFrequency, string> = {
  realtime: "in real time",
  "15m": "every 15 minutes",
  hourly: "every hour",
  daily: "once a day",
};

const ACCESS_ICONS: Record<AccessKind, LucideIcon> = {
  read: Eye,
  write: PenLine,
  sync: RefreshCw,
};

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  idle: "Connect",
  connecting: "Connecting",
  connected: "Connected",
};

const ENTER = [...motionTokens.ease.enter] as [number, number, number, number];
const STANDARD = [...motionTokens.ease.standard] as [number, number, number, number];
const INSTANT: { duration: number } = { duration: motionTokens.duration.instant };
const FADE_OUT = { opacity: 0, transition: INSTANT };
const REST = { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" };
const TEXT_ENTER = { opacity: 0, y: "0.35em", filter: `blur(${motionTokens.blur.soft}px)` };
const TEXT_EXIT = {
  opacity: 0,
  y: "-0.3em",
  filter: `blur(${motionTokens.blur.subtle}px)`,
  transition: { duration: motionTokens.duration.fast, ease: STANDARD },
};
const TEXT_SWAP = { duration: motionTokens.duration.standard, ease: ENTER };
const CARD_HIDDEN = { opacity: 0, filter: `blur(${motionTokens.blur.soft}px)` };
const CARD_EXIT = {
  opacity: 0,
  filter: `blur(${motionTokens.blur.soft}px)`,
  transition: { duration: motionTokens.duration.fast, ease: STANDARD },
};
/** Shared layout transitions carry the spring; opening also fades and de-blurs. */
const withDelay = (transition: { [key: string]: unknown }, delay = 0) => ({
  ...transition,
  delay,
  opacity: { duration: motionTokens.duration.standard, ease: ENTER, delay },
  filter: { duration: motionTokens.duration.standard, ease: ENTER, delay },
});
const CARD_TRANSITION = { ...withDelay(motionTokens.spring.smooth), layout: motionTokens.spring.smooth };
const COUNT_ROLL: Variants = {
  enter: (direction: number) => ({ opacity: 0, y: `${0.75 * direction}em`, filter: `blur(${motionTokens.blur.subtle}px)` }),
  center: { opacity: 1, y: 0, filter: "blur(0px)", transition: withDelay(motionTokens.spring.snappy) },
  exit: (direction: number) => ({
    opacity: 0,
    y: `${-0.75 * direction}em`,
    filter: `blur(${motionTokens.blur.subtle}px)`,
    transition: { duration: motionTokens.duration.fast, ease: STANDARD },
  }),
};
const COUNT_FADE: Variants = {
  enter: { opacity: 0 },
  center: { opacity: 1, y: 0, filter: "blur(0px)", transition: INSTANT },
  exit: FADE_OUT,
};

/** A mark that swaps copy in place; the outgoing word leaves upward as the new one rises. */
function TextSwap({ swapKey, reduce, className, children }: { swapKey: string; reduce: boolean; className?: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={swapKey}
        className={className}
        aria-hidden={reduce || undefined}
        initial={reduce ? { opacity: 0 } : TEXT_ENTER}
        animate={REST}
        exit={reduce ? FADE_OUT : TEXT_EXIT}
        transition={reduce ? INSTANT : TEXT_SWAP}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

/** A number that rolls in the direction of the change, so a recount reads as a count, not a flicker. */
function Count({ value, reduce }: { value: number; reduce: boolean }) {
  const [shown, setShown] = useState(value);
  const [direction, setDirection] = useState(1);
  if (shown !== value) {
    setShown(value);
    setDirection(value > shown ? 1 : -1);
  }
  return (
    <span className={styles.count} aria-hidden="true">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.span key={value} custom={direction} variants={reduce ? COUNT_FADE : COUNT_ROLL} initial="enter" animate="center" exit="exit">
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The check that draws itself once a provider finishes approving access. */
function CheckPath({ reduce }: { reduce: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        initial={!reduce && { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ pathLength: { duration: 0.34, ease: ENTER, delay: 0.1 }, opacity: { duration: 0.05, delay: 0.1 } }}
      />
    </svg>
  );
}

/**
 * Connect, Connecting, Connected share one pill: as the label changes the slot re-measures and
 * animates to the new width, so the row never jumps.
 */
function ConnectButton({
  name,
  status,
  reduce,
  onConnect,
  buttonRef,
}: {
  name: string;
  status: IntegrationStatus;
  reduce: boolean;
  onConnect: () => void;
  buttonRef?: RefObject<HTMLButtonElement | null>;
}) {
  const width = useMotionValue<number | string>("auto");
  const [content, setContent] = useState<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (!content || typeof ResizeObserver === "undefined") return;
    let measured: number | null = null;
    let phase: string | null = null;
    let controls: ReturnType<typeof animate> | null = null;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.borderBoxSize?.[0]?.inlineSize ?? content.offsetWidth;
      const nextPhase = content.dataset.phase ?? null;
      const shouldAnimate = measured !== null && phase !== nextPhase && !reduce && typeof width.get() === "number";
      measured = next;
      phase = nextPhase;
      controls?.stop();
      if (shouldAnimate) controls = animate(width, next, motionTokens.spring.morph);
      else width.jump(next);
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [content, reduce, width]);

  const glyph =
    status === "idle" ? (
      <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
    ) : status === "connecting" ? (
      <span className={styles.spinner} aria-hidden="true" />
    ) : (
      <CheckPath reduce={reduce} />
    );

  return (
    <motion.div
      className={styles.connect}
      data-status={status}
      whileTap={status !== "idle" || reduce ? undefined : { scale: 0.97 }}
      transition={motionTokens.spring.snappy}
    >
      <motion.span className={styles.connectSlot} style={{ width }}>
        <span ref={setContent} className={styles.connectContent} data-phase={status} aria-hidden={status !== "connected" || undefined}>
          <TextSwap swapKey={status} reduce={reduce} className={styles.connectPhase}>
            <span className={styles.phaseIcon}>{glyph}</span>
            {STATUS_LABELS[status]}
          </TextSwap>
        </span>
      </motion.span>
      {status !== "connected" ? (
        <button
          ref={buttonRef}
          type="button"
          className={styles.connectHit}
          aria-label={status === "connecting" ? `Connecting ${name}` : `Connect ${name}`}
          aria-busy={status === "connecting" || undefined}
          onClick={() => {
            if (status === "idle") onConnect();
          }}
        />
      ) : null}
    </motion.div>
  );
}

function Mark({ id, className }: { id: string; className?: string }) {
  const mark = MARKS[id];
  if (!mark) return null;
  if (mark.layers) {
    return (
      <svg className={className} width={22} height={22} viewBox={mark.viewBox ?? "0 0 24 24"} aria-hidden="true">
        {mark.layers.map(layer => (
          <path key={layer.fill} fill={layer.fill} d={layer.d} />
        ))}
      </svg>
    );
  }
  return (
    <svg className={className} data-dark-ink={mark.darkInk || undefined} style={{ color: mark.color }} width={22} height={22} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d={mark.d} />
    </svg>
  );
}

/** One row: a mark, the name that opens the sheet, the category, and the connection pill. */
function IntegrationCard({
  item,
  connection,
  reduce,
  layoutKey,
  descriptionId,
  onConnect,
  onOpen,
  registerTrigger,
}: {
  item: IntegrationItem;
  connection: IntegrationConnection;
  reduce: boolean;
  layoutKey: string;
  descriptionId: string;
  onConnect: (item: IntegrationItem) => void;
  onOpen: (item: IntegrationItem, trigger: HTMLButtonElement) => void;
  registerTrigger: (id: string, node: HTMLButtonElement | null) => void;
}) {
  const openRef = useRef<HTMLButtonElement | null>(null);
  const configureRef = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef(false);
  const connected = connection.status === "connected";

  // A connect that started on this row hands focus to Configure once the row settles.
  useEffect(() => {
    if (!connected || !pendingFocus.current) return;
    pendingFocus.current = false;
    if (document.activeElement && document.activeElement !== document.body) return;
    configureRef.current?.focus({ preventScroll: true });
    if (document.activeElement !== configureRef.current) openRef.current?.focus({ preventScroll: true });
  }, [connected]);

  return (
    <motion.li
      className={styles.card}
      data-status={connection.status}
      layout={reduce ? false : "position"}
      layoutDependency={layoutKey}
      initial={reduce ? { opacity: 0 } : CARD_HIDDEN}
      animate={REST}
      exit={reduce ? FADE_OUT : CARD_EXIT}
      transition={reduce ? INSTANT : CARD_TRANSITION}
    >
      <Mark id={item.id} className={styles.cardIcon} />
      <div className={styles.cardBody}>
        <div className={styles.cardTitle}>
          <h3 className={styles.cardName}>
            <button
              ref={node => {
                openRef.current = node;
                registerTrigger(item.id, node);
              }}
              type="button"
              className={styles.cardOpen}
              aria-haspopup="dialog"
              aria-describedby={descriptionId}
              onClick={event => onOpen(item, event.currentTarget)}
            >
              {item.name}
            </button>
          </h3>
          <span className={styles.cardCategory}>{CATEGORY_LABELS[item.category]}</span>
        </div>
        <p id={descriptionId} className={styles.cardText}>
          {item.description}
        </p>
      </div>
      <div className={styles.cardActions}>
        <AnimatePresence initial={false}>
          {connected ? (
            <motion.span
              key="configure"
              className={styles.configure}
              initial={reduce ? { opacity: 0 } : { opacity: 0, x: 8, filter: `blur(${motionTokens.blur.soft}px)` }}
              animate={REST}
              exit={reduce ? FADE_OUT : { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: STANDARD } }}
              transition={reduce ? INSTANT : withDelay(motionTokens.spring.snappy, 0.14)}
            >
              <Button ref={configureRef} type="button" variant="ghost" size="sm" aria-haspopup="dialog" aria-label={`Configure ${item.name}`} onClick={event => onOpen(item, event.currentTarget)}>
                Configure
              </Button>
            </motion.span>
          ) : null}
        </AnimatePresence>
        <ConnectButton
          name={item.name}
          status={connection.status}
          reduce={reduce}
          onConnect={() => {
            pendingFocus.current = true;
            onConnect(item);
          }}
        />
      </div>
    </motion.li>
  );
}

/** The sheet behind a row: connection state, what access is granted, and the controls that change it. */
function IntegrationSheet({
  item,
  connection,
  reduce,
  onConnect,
  onDisconnect,
  onFrequency,
}: {
  item: IntegrationItem;
  connection: IntegrationConnection;
  reduce: boolean;
  onConnect: (item: IntegrationItem) => void;
  onDisconnect: (item: IntegrationItem) => void;
  onFrequency: (item: IntegrationItem, frequency: IntegrationFrequency) => void;
}) {
  const accessId = useId();
  const connectRef = useRef<HTMLButtonElement | null>(null);
  const selectRef = useRef<HTMLButtonElement | null>(null);
  const pendingFocus = useRef(false);
  const { status, owner, frequency } = connection;

  // Approving access happens outside the sheet; when it lands, move focus to the next real control.
  useEffect(() => {
    if (!pendingFocus.current || status === "connecting") return;
    pendingFocus.current = false;
    (status === "connected" ? selectRef : connectRef).current?.focus({ preventScroll: true });
  }, [status]);

  const meta =
    status === "connected" && owner ? (
      <span className={styles.metaLine}>
        {owner.photo ? (
          <span aria-hidden="true">
            <Avatar name={owner.name} src={owner.photo} size="sm" />
          </span>
        ) : null}
        Connected by {owner.name} {owner.when === "just now" ? owner.when : `on ${owner.when}`}
      </span>
    ) : status === "connecting" ? (
      `Waiting for ${item.name} to approve access`
    ) : (
      "Not connected yet"
    );

  return (
    <div className={styles.sheet}>
      <div className={styles.sheetStatus}>
        <ConnectButton
          name={item.name}
          status={status}
          reduce={reduce}
          buttonRef={connectRef}
          onConnect={() => {
            pendingFocus.current = true;
            onConnect(item);
          }}
        />
        <p className={styles.sheetMeta}>
          <TextSwap swapKey={`${status}-${owner?.name ?? ""}`} reduce={reduce}>
            {meta}
          </TextSwap>
        </p>
      </div>
      <section className={styles.sheetSection} aria-labelledby={`${accessId}-access`}>
        <h3 id={`${accessId}-access`}>Access</h3>
        <p className={styles.sheetLead}>
          <TextSwap swapKey={status === "connected" ? "granted" : "requested"} reduce={reduce}>
            {status === "connected" ? `${item.name} can` : `${item.name} will be able to`}
          </TextSwap>
        </p>
        <ul className={styles.accessList} role="list">
          {item.access.map(access => {
            const Icon = ACCESS_ICONS[access.kind];
            return (
              <li key={access.text}>
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{access.text}</span>
              </li>
            );
          })}
        </ul>
      </section>
      <AnimatePresence initial={false}>
        {status === "connected" ? (
          <motion.div
            key="settings"
            className={styles.settingsFrame}
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduce ? FADE_OUT : { height: 0, opacity: 0, transition: { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: STANDARD } } }}
            transition={reduce ? INSTANT : { height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.standard, ease: ENTER, delay: 0.06 } }}
          >
            <div className={styles.settings}>
              <div className={styles.frequency}>
                <Select ref={selectRef} label="Sync frequency" value={frequency} options={FREQUENCIES} onValueChange={value => onFrequency(item, value as IntegrationFrequency)} />
                <p className={styles.hint}>
                  <TextSwap swapKey={frequency} reduce={reduce}>
                    {FREQUENCY_HINTS[frequency]}
                  </TextSwap>
                </p>
              </div>
              <div className={styles.dangerZone}>
                <HoldToConfirm
                  label="Hold to disconnect"
                  confirmedLabel="Disconnected"
                  icon={<Unplug size={16} strokeWidth={1.75} />}
                  onConfirm={() => {
                    pendingFocus.current = true;
                    onDisconnect(item);
                  }}
                />
                <p>Stops syncing and revokes {item.name}’s access.</p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * The integrations directory: filters recount as connections change, the search narrows by name,
 * category, or description, and every row opens a sheet with access and sync settings.
 */
export function Integrations() {
  const uid = useId();
  const reduce = !!useReducedMotion();
  const [connections, setConnections] = useState<Record<string, IntegrationConnection>>(() =>
    Object.fromEntries(
      INTEGRATIONS.map(item => [
        item.id,
        {
          status: item.owner ? "connected" : "idle",
          frequency: item.frequency,
          owner: item.owner ?? null,
        },
      ]),
    ),
  );
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(INTEGRATIONS[0].id);
  const [announcement, setAnnouncement] = useState("Choose a tool to see what it can access");
  const timers = useRef(new Map<string, number>());
  const triggers = useRef(new Map<string, HTMLButtonElement>());
  const filterRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const height = useMotionValue<number | string>("auto");
  const layoutAt = useRef(0);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(id => window.clearTimeout(id));
    };
  }, []);

  const needle = query.trim().toLowerCase();
  const matches = useCallback(
    (item: IntegrationItem, value: string) =>
      value === "all" || (value === "connected" ? connections[item.id].status === "connected" : item.category === value),
    [connections],
  );
  const visible = INTEGRATIONS.filter(
    item => matches(item, filter) && (!needle || `${item.name} ${CATEGORY_LABELS[item.category]} ${item.description}`.toLowerCase().includes(needle)),
  );
  const counts = Object.fromEntries(FILTERS.map(option => [option.value, INTEGRATIONS.filter(item => matches(item, option.value)).length]));
  const layoutKey = visible.map(item => item.id).join();
  const active = INTEGRATIONS.find(item => item.id === activeId) ?? INTEGRATIONS[0];

  // The frame owns the height so the page below never jumps while the list filters or recovers.
  useLayoutEffect(() => {
    layoutAt.current = performance.now();
  }, [layoutKey]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    let measured: number | undefined;
    let controls: ReturnType<typeof animate> | null = null;
    const settle = () => {
      height.jump("auto");
      if (frameRef.current) frameRef.current.style.overflow = "";
    };
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.borderBoxSize?.[0]?.blockSize ?? content.offsetHeight;
      const current = height.get();
      const from = typeof current === "number" ? current : measured;
      measured = next;
      controls?.stop();
      if (reduce || from === undefined || Math.abs(from - next) < 0.5 || performance.now() - layoutAt.current > 200) {
        settle();
        return;
      }
      if (frameRef.current) Object.assign(frameRef.current.style, { overflow: "clip", height: `${from}px` });
      controls = animate(height, [from, next], { ...motionTokens.spring.smooth, onComplete: settle });
    });
    observer.observe(content);
    return () => {
      observer.disconnect();
      controls?.stop();
    };
  }, [height, reduce]);

  function patch(id: string, next: Partial<IntegrationConnection>) {
    setConnections(current => ({ ...current, [id]: { ...current[id], ...next } }));
  }

  function schedule(id: string, delay: number, run: () => void) {
    window.clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      window.setTimeout(() => {
        timers.current.delete(id);
        run();
      }, delay),
    );
  }

  function connect(item: IntegrationItem) {
    if (connections[item.id].status !== "idle") return;
    patch(item.id, { status: "connecting" });
    setAnnouncement(`Connecting ${item.name}`);
    schedule(item.id, 1400, () => {
      patch(item.id, { status: "connected", owner: { name: "you", when: "just now" } });
      setAnnouncement(`${item.name} connected`);
    });
  }

  function describe(value: string, search: string) {
    const total = INTEGRATIONS.filter(
      item => matches(item, value) && (!search || `${item.name} ${CATEGORY_LABELS[item.category]} ${item.description}`.toLowerCase().includes(search)),
    ).length;
    const noun = total === 1 ? "integration" : "integrations";
    if (search) return `${total} ${total === 1 ? "result" : "results"} for “${search}”`;
    if (value === "all") return `Showing ${total} ${noun}`;
    return `Showing ${total} ${value === "connected" ? "connected" : CATEGORY_LABELS[value as IntegrationCategory].toLowerCase()} ${noun}`;
  }

  function selectFilter(value: string) {
    setFilter(value);
    setAnnouncement(describe(value, needle));
  }

  function openSheet(item: IntegrationItem, trigger: HTMLButtonElement) {
    lastTrigger.current = trigger;
    setActiveId(item.id);
    setOpen(true);
  }

  function registerTrigger(id: string, node: HTMLButtonElement | null) {
    if (node) triggers.current.set(id, node);
    else triggers.current.delete(id);
  }

  return (
    <section className={styles.root} aria-labelledby={`${uid}-title`}>
      <header className={styles.header}>
        <div className={styles.intro}>
          <h2 id={`${uid}-title`} ref={titleRef} tabIndex={-1}>
            Integrations
          </h2>
          <p>Connect the tools your team already works in.</p>
        </div>
        <div className={styles.search}>
          <SearchField
            ref={searchRef}
            label="Search integrations"
            placeholder="Search by name or category"
            autoComplete="off"
            value={query}
            onValueChange={value => {
              setQuery(value);
              setAnnouncement(describe(filter, value.trim().toLowerCase()));
            }}
          />
        </div>
      </header>
      <motion.div
        className={styles.filters}
        role="radiogroup"
        aria-label="Filter integrations"
        onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
          const index = FILTERS.findIndex(option => option.value === filter);
          const targets: Record<string, number> = {
            ArrowRight: index + 1,
            ArrowDown: index + 1,
            ArrowLeft: index - 1,
            ArrowUp: index - 1,
            Home: 0,
            End: FILTERS.length - 1,
          };
          if (!(event.key in targets)) return;
          event.preventDefault();
          const next = FILTERS[(targets[event.key] + FILTERS.length) % FILTERS.length].value;
          selectFilter(next);
          filterRefs.current.get(next)?.focus();
        }}
        layoutScroll
      >
        {FILTERS.map(option => {
          const selected = option.value === filter;
          return (
            <button
              key={option.value}
              ref={node => {
                if (node) filterRefs.current.set(option.value, node);
                else filterRefs.current.delete(option.value);
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${option.label}, ${counts[option.value]}`}
              tabIndex={selected ? 0 : -1}
              className={styles.filter}
              onClick={event => {
                selectFilter(option.value);
                event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduce ? "auto" : "smooth" });
              }}
            >
              {selected ? (
                <motion.span
                  layoutId="filter-highlight"
                  className={styles.highlight}
                  style={{ borderRadius: 14 }}
                  transition={reduce ? { duration: 0 } : motionTokens.spring.morph}
                />
              ) : null}
              <span className={styles.filterLabel}>{option.label}</span>
              <Count value={counts[option.value]} reduce={reduce} />
            </button>
          );
        })}
      </motion.div>
      <motion.div ref={frameRef} className={styles.frame} style={{ height }}>
        <div ref={contentRef} className={styles.content}>
          <ul className={styles.list} role="list" aria-label="Integrations">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map(item => (
                <IntegrationCard
                  key={item.id}
                  item={item}
                  connection={connections[item.id]}
                  reduce={reduce}
                  layoutKey={layoutKey}
                  descriptionId={`${uid}-${item.id}-description`}
                  onConnect={connect}
                  onOpen={openSheet}
                  registerTrigger={registerTrigger}
                />
              ))}
            </AnimatePresence>
          </ul>
          <AnimatePresence mode="popLayout" initial={false}>
            {visible.length === 0 ? (
              <motion.div
                key={needle ? "no-results" : "none-connected"}
                className={styles.empty}
                initial={reduce ? { opacity: 0 } : CARD_HIDDEN}
                animate={REST}
                exit={FADE_OUT}
                transition={reduce ? INSTANT : TEXT_SWAP}
              >
                <p>{needle ? `No integrations match “${query.trim()}”` : "Nothing connected yet"}</p>
                <span>{needle ? "Try a product name or a category such as storage." : "Connect a tool and it will show up here."}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (needle) {
                      setQuery("");
                      setAnnouncement(describe(filter, ""));
                      searchRef.current?.focus();
                      return;
                    }
                    selectFilter("all");
                    filterRefs.current.get("all")?.focus();
                  }}
                >
                  {needle ? "Clear search" : "Browse all"}
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </motion.div>
      <footer className={styles.srOnly}>
        <p role="status" aria-live="polite">
          <TextSwap swapKey={announcement} reduce={reduce}>
            {announcement}
          </TextSwap>
        </p>
      </footer>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent
          side="right"
          title={active.name}
          description={active.description}
          onCloseAutoFocus={event => {
            event.preventDefault();
            const target = lastTrigger.current?.isConnected ? lastTrigger.current : (triggers.current.get(activeId) ?? titleRef.current);
            target?.focus({ preventScroll: true });
          }}
        >
          <IntegrationSheet
            key={active.id}
            item={active}
            connection={connections[active.id]}
            reduce={reduce}
            onConnect={connect}
            onDisconnect={item => {
              schedule(item.id, 650, () => {
                patch(item.id, { status: "idle", owner: null });
                setAnnouncement(`${item.name} disconnected`);
              });
            }}
            onFrequency={(item, value) => {
              patch(item.id, { frequency: value });
              setAnnouncement(`${item.name} now syncs ${FREQUENCY_PHRASES[value]}`);
            }}
          />
        </DrawerContent>
      </Drawer>
    </section>
  );
}

export default Integrations;
