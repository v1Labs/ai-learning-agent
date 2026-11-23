#!/usr/bin/env python3
"""Simulates when XP level thresholds trigger across lesson shapes and learner profiles.

Evidence for docs/adr/0007. Keep BASE/BONUS in sync with the XP rules. Usage: python3 scripts/simulate-xp.py
"""
import random, statistics as st
BASE = {"b":10,"i":15,"a":20}; BONUS = 5
PLANS = {"A&P (real)":"bibiia","easy start":"bbiia","hard start":"iiaa","short":"bia"}
PROFILES = {"strong":0.85,"average":0.55,"hint-reliant":0.20}  # P(unaided)
def questions(plan, n=10):
    k=len(plan); per=[n//k + (1 if i < n%k else 0) for i in range(k)]
    return [d for d,c in zip(plan,per) for _ in range(c)]
def level_at(qs, p, thr):
    xp=0
    for i,d in enumerate(qs,1):
        xp += BASE[d] + (BONUS if random.random()<p else 0)
        if xp>=thr: return i
    return None
def run(thr, trials=4000):
    print(f"\n== threshold {thr} XP: question # when reached (min / median / max)")
    for pn,plan in PLANS.items():
        qs=questions(plan); row=[]
        for prof,p in PROFILES.items():
            r=[level_at(qs,p,thr) for _ in range(trials)]; r=[x if x else 99 for x in r]
            row.append(f"{prof}: {min(r)}/{int(st.median(r))}/{max(r)}")
        print(f"  {pn:11} {''.join(qs)}  " + " | ".join(row))
random.seed(1)
for t in (20, 25, 60, 70): run(t)
