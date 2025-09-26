'use client';

import { useState, useMemo } from 'react';
import { VirtualizedTable, EnhancedVirtualizedTable } from './VirtualizedTable';
import { WindowedTable } from './WindowedTable';
import { generateTestData } from '@/lib/hooks/useVirtualizer';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Generate test data
interface TestRow {
  id: number;
  name: string;
  email: string;
  age: number;
  city: string;
  score: number;
  status: 'active' | 'inactive' | 'pending';
  createdAt: string;
}

function generateRow(index: number): TestRow {
  const statuses: TestRow['status'][] = ['active', 'inactive', 'pending'];
  const cities = ['New York', 'London', 'Tokyo', 'Paris', 'Berlin', 'Sydney', 'Toronto', 'Dubai'];

  return {
    id: index + 1,
    name: `User ${index + 1}`,
    email: `user${index + 1}@example.com`,
    age: 20 + (index % 50),
    city: cities[index % cities.length],
    score: Math.floor(Math.random() * 100),
    status: statuses[index % 3],
    createdAt: new Date(Date.now() - Math.random() * 10000000000).toISOString(),
  };
}

/**
 * Demo component for testing virtual scrolling with large datasets
 */
export function VirtualTableDemo() {
  const [rowCount, setRowCount] = useState(10000);
  const [loading, setLoading] = useState(false);

  // Generate test data
  const data = useMemo(() => generateTestData(rowCount, generateRow), [rowCount]);

  // Define columns
  const columns = [
    {
      key: 'id',
      header: 'ID',
      width: 80,
    },
    {
      key: 'name',
      header: 'Name',
      width: 200,
    },
    {
      key: 'email',
      header: 'Email',
      width: 250,
    },
    {
      key: 'age',
      header: 'Age',
      width: 80,
    },
    {
      key: 'city',
      header: 'City',
      width: 150,
    },
    {
      key: 'score',
      header: 'Score',
      width: 100,
      render: (item: TestRow) => (
        <span
          className={
            item.score > 70
              ? 'text-green-600'
              : item.score > 40
                ? 'text-yellow-600'
                : 'text-red-600'
          }
        >
          {item.score}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      render: (item: TestRow) => (
        <span
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            item.status === 'active'
              ? 'bg-green-100 text-green-700'
              : item.status === 'pending'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {item.status}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      width: 200,
      render: (item: TestRow) => new Date(item.createdAt).toLocaleDateString(),
    },
  ];

  const handleGenerateData = (count: number) => {
    setLoading(true);
    setRowCount(count);
    setTimeout(() => setLoading(false), 100);
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Virtual Table Demo</h2>
        <p className="text-muted-foreground">
          Test virtual scrolling performance with large datasets
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <Button
          onClick={() => handleGenerateData(100)}
          variant={rowCount === 100 ? 'default' : 'outline'}
        >
          100 rows
        </Button>
        <Button
          onClick={() => handleGenerateData(1000)}
          variant={rowCount === 1000 ? 'default' : 'outline'}
        >
          1,000 rows
        </Button>
        <Button
          onClick={() => handleGenerateData(10000)}
          variant={rowCount === 10000 ? 'default' : 'outline'}
        >
          10,000 rows
        </Button>
        <Button
          onClick={() => handleGenerateData(50000)}
          variant={rowCount === 50000 ? 'default' : 'outline'}
        >
          50,000 rows
        </Button>
        <Button
          onClick={() => handleGenerateData(100000)}
          variant={rowCount === 100000 ? 'default' : 'outline'}
        >
          100,000 rows
        </Button>
      </div>

      {/* Performance Stats */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="font-semibold mb-2">Performance Metrics</h3>
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Total Rows:</span>{' '}
            <span className="font-mono">{rowCount.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Data Size:</span>{' '}
            <span className="font-mono">~{(rowCount * 0.5).toFixed(0)}KB</span>
          </div>
          <div>
            <span className="text-muted-foreground">Rendered:</span>{' '}
            <span className="font-mono">~15-20 rows</span>
          </div>
          <div>
            <span className="text-muted-foreground">Memory Saved:</span>{' '}
            <span className="font-mono text-green-600">~98%</span>
          </div>
        </div>
      </div>

      {/* Table Implementations */}
      <Tabs defaultValue="tanstack" className="w-full">
        <TabsList>
          <TabsTrigger value="tanstack">TanStack Virtual</TabsTrigger>
          <TabsTrigger value="enhanced">Enhanced Virtual</TabsTrigger>
          <TabsTrigger value="windowed">React Window</TabsTrigger>
        </TabsList>

        <TabsContent value="tanstack" className="mt-6">
          <VirtualizedTable
            data={data}
            columns={columns}
            containerHeight={600}
            loading={loading}
            onRowClick={(item, index) => {
              console.log('Clicked row:', index, item);
            }}
            enableHorizontalScroll
            stickyHeader
          />
        </TabsContent>

        <TabsContent value="enhanced" className="mt-6">
          <EnhancedVirtualizedTable
            data={data}
            columns={columns}
            containerHeight={600}
            loading={loading}
            enableSearch
            enableSort
            showPerformanceStats
          />
        </TabsContent>

        <TabsContent value="windowed" className="mt-6">
          <WindowedTable
            data={data}
            columns={columns}
            height={600}
            onRowClick={(item, index) => {
              console.log('Clicked row:', index, item);
            }}
          />
        </TabsContent>
      </Tabs>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Testing Instructions</h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Try different row counts to test performance</li>
          <li>• Scroll quickly to test rendering speed</li>
          <li>• Use keyboard navigation (arrows, Page Up/Down, Home/End)</li>
          <li>• Click rows to test interaction</li>
          <li>• Compare different implementations</li>
          <li>• Monitor browser DevTools Performance tab for metrics</li>
        </ul>
      </div>
    </div>
  );
}
