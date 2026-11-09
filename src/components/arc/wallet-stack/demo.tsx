"use client";

import { ArrowDownLeft, Bike, Coffee, Croissant, Plane, ShoppingBasket, TrainFront, Utensils } from "lucide-react";
import { WalletStack, type WalletStackCard } from "./wallet-stack";
import styles from "./demo.module.css";

export const meta = "Live · component";

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

const CARDS: WalletStackCard[] = [
  {
    id: "fieldnote",
    issuer: "Fieldnote",
    product: "Everyday debit",
    lastFour: "4821",
    holder: "Jordan Hayes",
    expires: "09/29",
    variant: "metal",
    balance: 3248.6,
    balanceLabel: "Available",
    transactions: [
      {
        id: "fn-1",
        merchant: "Ryan Mitchell",
        detail: "Dinner split · Today",
        amount: 36.5,
        avatar: "/media/specials/wallet-stack-ryan.svg",
      },
      {
        id: "fn-2",
        merchant: "Greenleaf Market",
        detail: "Groceries · Yesterday",
        amount: -84.12,
        icon: <ShoppingBasket {...ICON} />,
      },
      {
        id: "fn-3",
        merchant: "Brightline Studio",
        detail: "Payroll · Sep 18",
        amount: 2860,
        icon: <ArrowDownLeft {...ICON} />,
      },
    ],
  },
  {
    id: "meridian",
    issuer: "Meridian",
    product: "Reserve credit",
    lastFour: "0917",
    holder: "Jordan Hayes",
    expires: "03/28",
    variant: "black",
    balance: 1286.44,
    balanceLabel: "Spent in September",
    transactions: [
      {
        id: "md-1",
        merchant: "Alder & Pine",
        detail: "Dining · Sep 20",
        amount: -142.8,
        icon: <Utensils {...ICON} />,
      },
      {
        id: "md-2",
        merchant: "Cascade Air",
        detail: "Travel · Sep 17",
        amount: -389,
        icon: <Plane {...ICON} />,
      },
      {
        id: "md-3",
        merchant: "Emily Parker",
        detail: "Concert tickets · Sep 16",
        amount: 64,
        avatar: "/media/specials/wallet-stack-emily.svg",
      },
    ],
  },
  {
    id: "tidewater",
    issuer: "Tidewater",
    product: "Transit pass",
    lastFour: "3306",
    holder: "Jordan Hayes",
    expires: "11/27",
    variant: "glass",
    balance: 42.25,
    balanceLabel: "Pass balance",
    transactions: [
      {
        id: "tw-1",
        merchant: "Harbor line",
        detail: "Ferry · Today, 7:52 AM",
        amount: -3.25,
        icon: <TrainFront {...ICON} />,
      },
      {
        id: "tw-2",
        merchant: "Bike share",
        detail: "22 min ride · Yesterday",
        amount: -2.5,
        icon: <Bike {...ICON} />,
      },
      {
        id: "tw-3",
        merchant: "Auto top up",
        detail: "From Fieldnote · Sep 15",
        amount: 40,
        icon: <ArrowDownLeft {...ICON} />,
      },
    ],
  },
  {
    id: "common-ground",
    issuer: "Common Ground",
    product: "Coffee club",
    lastFour: "7730",
    holder: "Jordan Hayes",
    expires: "06/28",
    variant: "color",
    tint: "oklch(40% .1 162)",
    balance: 18.4,
    balanceLabel: "Prepaid",
    transactions: [
      {
        id: "cg-1",
        merchant: "Oat cortado",
        detail: "Pearl Street · Today, 8:10 AM",
        amount: -4.6,
        icon: <Coffee {...ICON} />,
      },
      {
        id: "cg-2",
        merchant: "Morning bun",
        detail: "Pearl Street · Yesterday",
        amount: -3.9,
        icon: <Croissant {...ICON} />,
      },
      {
        id: "cg-3",
        merchant: "Reload",
        detail: "From Fieldnote · Sep 14",
        amount: 25,
        icon: <ArrowDownLeft {...ICON} />,
      },
    ],
  },
];

export default function WalletStackDemo() {
  return (
    <div className={styles.demo}>
      <WalletStack cards={CARDS} label="Jordan’s cards" />
    </div>
  );
}
