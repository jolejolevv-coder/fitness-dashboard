import type { DayTolerance } from '../config/generator';
import type { PlanData } from '../nutrition/plan';
import { validatePlan } from '../nutrition/plan';
import { NO_OVERRIDES, effectivePlan } from '../nutrition/rotation';
import { dayMacros } from '../nutrition/totals';
import type { Weekday } from '../nutrition/types';
import type { DayGoals } from '../parse/goals';
import type { Proposal } from './response';

/** Die Ziele, die ein Vorschlag erfuellen muss. KH und Ballaststoffe werden nur angezeigt. */
const REQUIRED_GOAL_FIELDS = ['caloriesKcal', 'proteinG', 'fatG'] as const;

export function goalsReadiness(goals: DayGoals | null): { available: number; required: number } {
  const available = goals ? REQUIRED_GOAL_FIELDS.filter((field) => goals[field] !== null).length : 0;
  return { available, required: REQUIRED_GOAL_FIELDS.length };
}

export interface DayCheck {
  day: Weekday;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface ProposalCheck {
  passed: boolean;
  issues: string[];
  days: DayCheck[];
}

interface RequiredGoals {
  kcal: number;
  protein: number;
  fat: number;
}

function requiredGoals(goals: DayGoals): RequiredGoals | null {
  const { caloriesKcal, proteinG, fatG } = goals;
  if (caloriesKcal === null || proteinG === null || fatG === null) return null;
  return { kcal: caloriesKcal, protein: proteinG, fat: fatG };
}

function findExclusions(proposal: Proposal, exclusions: ReadonlySet<string>): string[] {
  const issues: string[] = [];
  for (const meal of proposal.meals) {
    for (const ing of meal.ingredients) {
      if (exclusions.has(ing.foodId)) issues.push(`Ausschluss ${ing.foodId} in ${meal.id}`);
    }
  }
  return issues;
}

/** Eine Zahlenzeile je Verstoss. Verglichen wird, was die Zeile zeigt: auf ganze Zahlen gerundet. */
function checkDay(day: DayCheck, goals: RequiredGoals, tolerance: DayTolerance): string[] {
  const issues: string[] = [];
  if (Math.abs(day.kcal - goals.kcal) > tolerance.kcalBand) {
    issues.push(`${day.day} kcal ${day.kcal} Ziel ${Math.round(goals.kcal)} ±${tolerance.kcalBand}`);
  }
  if (day.protein < goals.protein) {
    issues.push(`${day.day} Protein ${day.protein} Ziel ${Math.round(goals.protein)}`);
  }
  if (Math.abs(day.fat - goals.fat) > tolerance.fatBandG) {
    issues.push(`${day.day} Fett ${day.fat} Ziel ${Math.round(goals.fat)} ±${tolerance.fatBandG}`);
  }
  return issues;
}

function failed(issues: string[], days: DayCheck[] = []): ProposalCheck {
  return { passed: false, issues, days };
}

export function checkProposal(
  proposal: Proposal,
  base: PlanData,
  goals: DayGoals,
  exclusions: ReadonlySet<string>,
  tolerance: DayTolerance,
): ProposalCheck {
  const required = requiredGoals(goals);
  if (!required) return failed([`Ziele ${goalsReadiness(goals).available} von ${goalsReadiness(goals).required}`]);

  const plan: PlanData = {
    foods: base.foods,
    shoppingItems: base.shoppingItems,
    meals: proposal.meals,
    rotation: proposal.rotation,
    prep: proposal.prep,
  };
  const structural = [...validatePlan(plan), ...findExclusions(proposal, exclusions)];
  const effective = effectivePlan(plan.rotation, NO_OVERRIDES, plan.meals);
  // Ohne stimmige Verweise lassen sich die Tage nicht sicher rechnen.
  if (structural.length > 0 || effective.issues.length > 0) return failed([...structural, ...effective.issues]);

  const days: DayCheck[] = effective.days.map((planned) => {
    const macros = dayMacros(planned, plan.foods);
    return {
      day: planned.day,
      kcal: Math.round(macros.kcal),
      protein: Math.round(macros.protein),
      carbs: Math.round(macros.carbs),
      fat: Math.round(macros.fat),
      fiber: Math.round(macros.fiber),
    };
  });
  const issues = days.flatMap((day) => checkDay(day, required, tolerance));
  return { passed: issues.length === 0, issues, days };
}
