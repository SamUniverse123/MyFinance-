import * as React from 'react';
import {
  Tabs as TabsPrimitive,
  TabsList as TabsListPrimitive,
  TabsTrigger as TabsTriggerPrimitive,
  TabsContent as TabsContentPrimitive,
  TabsContents as TabsContentsPrimitive,
  TabsHighlight as TabsHighlightPrimitive,
  TabsHighlightItem as TabsHighlightItemPrimitive,
  type TabsProps as TabsPrimitiveProps,
  type TabsListProps as TabsListPrimitiveProps,
  type TabsTriggerProps as TabsTriggerPrimitiveProps,
  type TabsContentProps as TabsContentPrimitiveProps,
  type TabsContentsProps as TabsContentsPrimitiveProps,
} from '#/components/animate-ui/primitives/radix/tabs.tsx';
import { cn } from '#/lib/utils.ts';

type TabsVariant = 'slot' | 'line';

// The variant is chosen on <TabsList> and read back by the sibling <TabsTrigger>s,
// so it travels through a context rather than being threaded prop-by-prop.
const TabsVariantContext = React.createContext<TabsVariant>('slot');

function useTabsVariant() {
  return React.useContext(TabsVariantContext);
}

type TabsProps = TabsPrimitiveProps;

function Tabs({ className, ...props }: TabsProps) {
  return (
    <TabsPrimitive
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  );
}

type TabsListProps = TabsListPrimitiveProps & {
  variant?: TabsVariant;
};

function TabsList({ className, variant = 'slot', ...props }: TabsListProps) {
  // In "children" highlight mode the moving element is positioned inside each
  // trigger's own cell: `inset-0` fills the cell for the pill (slot), while
  // `bottom-0 inset-x-0 h-0.5` pins a sliding underline for the line variant.
  const highlightClassName =
    variant === 'line'
      ? 'absolute z-0 inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground'
      : 'absolute z-0 inset-0 border border-transparent rounded-md bg-background dark:border-input dark:bg-input/30 shadow-sm';

  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsHighlightPrimitive className={highlightClassName}>
        <TabsListPrimitive
          data-variant={variant}
          className={cn(
            variant === 'line'
              ? 'text-muted-foreground relative inline-flex w-fit items-center justify-center bg-transparent'
              : 'bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
            className,
          )}
          {...props}
        />
      </TabsHighlightPrimitive>
    </TabsVariantContext.Provider>
  );
}

type TabsTriggerProps = TabsTriggerPrimitiveProps;

function TabsTrigger({ className, ...props }: TabsTriggerProps) {
  const variant = useTabsVariant();

  return (
    <TabsHighlightItemPrimitive value={props.value} className="flex-1">
      <TabsTriggerPrimitive
        className={cn(
          "data-[state=active]:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-muted-foreground inline-flex flex-1 items-center justify-center gap-1.5 w-full whitespace-nowrap text-sm font-medium transition-colors duration-500 ease-in-out focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          variant === 'line'
            ? 'relative rounded-none px-2 pt-1 pb-2.5'
            : 'h-[calc(100%-1px)] rounded-md px-2 py-1',
          className,
        )}
        {...props}
      />
    </TabsHighlightItemPrimitive>
  );
}

type TabsContentsProps = TabsContentsPrimitiveProps;

function TabsContents(props: TabsContentsProps) {
  return <TabsContentsPrimitive {...props} />;
}

type TabsContentProps = TabsContentPrimitiveProps;

function TabsContent({ className, ...props }: TabsContentProps) {
  return (
    <TabsContentPrimitive
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContents,
  TabsContent,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentsProps,
  type TabsContentProps,
};
