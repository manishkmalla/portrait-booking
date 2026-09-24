import { Calendar as ShadcnCalendar } from './ui/calendar';
import { Card, CardContent } from './ui/card';
import { fromDateKey, startOfMonth, toDateKey } from '../lib/date';
import type { Slot } from '../types';

export function Calendar(props: {
  month: Date;
  slotsByDate: Record<string, Slot[]>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
  onMonthChange: (month: Date) => void;
}) {
  function hasSlots(date: Date): boolean {
    return (props.slotsByDate[toDateKey(date)]?.length ?? 0) > 0;
  }

  return (
    // Same shape as shadcn's own "Booked Dates" example (Card + CardContent
    // wrapping a single-select Calendar driven by `disabled`) — inverted,
    // since we disable days with no slots rather than days that are booked.
    <Card className="w-fit p-0">
      <CardContent className="p-0">
        <ShadcnCalendar
          mode="single"
          month={props.month}
          onMonthChange={props.onMonthChange}
          startMonth={startOfMonth(new Date())}
          selected={props.selectedDate ? fromDateKey(props.selectedDate) : undefined}
          onSelect={(date) => {
            if (date) props.onSelectDate(toDateKey(date));
          }}
          disabled={(date) => !hasSlots(date)}
          className="[--cell-size:2.75rem] md:[--cell-size:3rem]"
        />
      </CardContent>
    </Card>
  );
}
