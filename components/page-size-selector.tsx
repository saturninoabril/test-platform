'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function PageSizeSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPageSize = searchParams.get('pageSize') || '50';

  const handlePageSizeChange = (newPageSize: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageSize', newPageSize);
    params.set('page', '1'); // Reset to first page when changing page size
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">Items per page:</span>
      <Select value={currentPageSize} onValueChange={handlePageSizeChange}>
        <SelectTrigger className="w-[80px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="50">50</SelectItem>
          <SelectItem value="100">100</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
