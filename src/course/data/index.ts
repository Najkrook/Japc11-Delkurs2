import type { CourseWeek } from '../types.ts';
import { week1Lesson6 } from './week1-lesson6.ts';
import { week2Lesson7 } from './week2-lesson7.ts';
import { week3Lesson8, week4Lesson9 } from './week3-4-preview.ts';

export const courseWeeks: CourseWeek[] = [week1Lesson6, week2Lesson7, week3Lesson8, week4Lesson9];

export function getCourseWeekById(weekId: string): CourseWeek {
  return courseWeeks.find((w) => w.id === weekId) ?? week1Lesson6;
}
