'use client'

import * as React from 'react'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@pasosdejesus/m/shadcn-components/ui/accordion'
import { Alert, AlertTitle, AlertDescription } from '@pasosdejesus/m/shadcn-components/ui/alert'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@pasosdejesus/m/shadcn-components/ui/alert-dialog'
import { Avatar, AvatarImage, AvatarFallback } from '@pasosdejesus/m/shadcn-components/ui/avatar'
import { Badge } from '@pasosdejesus/m/shadcn-components/ui/badge'
import { Button } from '@pasosdejesus/m/shadcn-components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@pasosdejesus/m/shadcn-components/ui/card'
import { Checkbox } from '@pasosdejesus/m/shadcn-components/ui/checkbox'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@pasosdejesus/m/shadcn-components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@pasosdejesus/m/shadcn-components/ui/dropdown-menu'
import { Input } from '@pasosdejesus/m/shadcn-components/ui/input'
import { Label } from '@pasosdejesus/m/shadcn-components/ui/label'
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
} from '@pasosdejesus/m/shadcn-components/ui/menubar'
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@pasosdejesus/m/shadcn-components/ui/popover'
import { Progress } from '@pasosdejesus/m/shadcn-components/ui/progress'
import {
  RadioGroup,
  RadioGroupItem,
} from '@pasosdejesus/m/shadcn-components/ui/radio-group'
import { ScrollArea } from '@pasosdejesus/m/shadcn-components/ui/scroll-area'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@pasosdejesus/m/shadcn-components/ui/select'
import { Separator } from '@pasosdejesus/m/shadcn-components/ui/separator'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@pasosdejesus/m/shadcn-components/ui/sheet'
import { Skeleton } from '@pasosdejesus/m/shadcn-components/ui/skeleton'
import { Slider } from '@pasosdejesus/m/shadcn-components/ui/slider'
import { Switch } from '@pasosdejesus/m/shadcn-components/ui/switch'
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@pasosdejesus/m/shadcn-components/ui/table'
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@pasosdejesus/m/shadcn-components/ui/tabs'
import { Textarea } from '@pasosdejesus/m/shadcn-components/ui/textarea'
import { Toast, ToastProvider, ToastViewport } from '@pasosdejesus/m/shadcn-components/ui/toast'
import { Toaster } from '@pasosdejesus/m/shadcn-components/ui/toaster'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from '@pasosdejesus/m/shadcn-components/ui/tooltip'

function TestSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 p-4 border rounded-lg">
      <h2 className="text-lg font-bold mb-4">{title}</h2>
      <div className="flex flex-wrap gap-4 items-start">{children}</div>
    </div>
  )
}

export default function TestUI() {
  const [progress, setProgress] = React.useState(45)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">shadcn Components Test</h1>
      <p className="text-muted-foreground mb-8">
        All components imported from @pasosdejesus/m/shadcn-components/ui/*
      </p>

      <TestSection title="Accordion">
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="item-1">
            <AccordionTrigger>Is it accessible?</AccordionTrigger>
            <AccordionContent>Yes. It uses Radix UI primitives.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </TestSection>

      <TestSection title="Alert">
        <Alert>
          <AlertTitle>Heads up!</AlertTitle>
          <AlertDescription>This is an alert component.</AlertDescription>
        </Alert>
      </TestSection>

      <TestSection title="AlertDialog">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogAction>Continue</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>
      </TestSection>

      <TestSection title="Avatar">
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" />
          <AvatarFallback>CN</AvatarFallback>
        </Avatar>
      </TestSection>

      <TestSection title="Badge">
        <Badge>Badge</Badge>
      </TestSection>

      <TestSection title="Button">
        <Button>Click me</Button>
        <Button variant="destructive">Delete</Button>
        <Button variant="outline">Outline</Button>
      </TestSection>

      <TestSection title="Card">
        <Card className="w-60">
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
          <CardContent>Card content here.</CardContent>
        </Card>
      </TestSection>

      <TestSection title="Checkbox">
        <div className="flex items-center gap-2">
          <Checkbox id="c1" />
          <Label htmlFor="c1">Accept terms</Label>
        </div>
      </TestSection>

      <TestSection title="Dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog description.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </TestSection>

      <TestSection title="DropdownMenu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TestSection>

      <TestSection title="Input + Label">
        <div className="grid w-60 gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" placeholder="Enter your name" />
        </div>
      </TestSection>

      <TestSection title="Menubar">
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>New</MenubarItem>
              <MenubarItem>Open</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </TestSection>

      <TestSection title="Popover">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Open Popover</Button>
          </PopoverTrigger>
          <PopoverContent>Popover content here.</PopoverContent>
        </Popover>
      </TestSection>

      <TestSection title="Progress">
        <Progress value={progress} className="w-60" />
      </TestSection>

      <TestSection title="RadioGroup">
        <RadioGroup defaultValue="option-1">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="option-1" id="r1" />
            <Label htmlFor="r1">Option 1</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="option-2" id="r2" />
            <Label htmlFor="r2">Option 2</Label>
          </div>
        </RadioGroup>
      </TestSection>

      <TestSection title="ScrollArea">
        <ScrollArea className="h-20 w-60 border rounded p-2">
          <div className="h-40">Scrollable content line 1<br />line 2<br />line 3<br />line 4</div>
        </ScrollArea>
      </TestSection>

      <TestSection title="Select">
        <Select>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Option 1</SelectItem>
            <SelectItem value="2">Option 2</SelectItem>
          </SelectContent>
        </Select>
      </TestSection>

      <TestSection title="Separator">
        <div>
          <span>Above</span>
          <Separator className="my-2" />
          <span>Below</span>
        </div>
      </TestSection>

      <TestSection title="Sheet">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet Title</SheetTitle>
              <SheetDescription>Sheet description.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </TestSection>

      <TestSection title="Skeleton">
        <div className="space-y-2 w-60">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </TestSection>

      <TestSection title="Slider">
        <Slider defaultValue={[50]} max={100} step={1} className="w-60" />
      </TestSection>

      <TestSection title="Switch">
        <div className="flex items-center gap-2">
          <Switch id="s1" />
          <Label htmlFor="s1">Airplane mode</Label>
        </div>
      </TestSection>

      <TestSection title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>John</TableCell>
              <TableCell>john@example.com</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TestSection>

      <TestSection title="Tabs">
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>
      </TestSection>

      <TestSection title="Textarea">
        <Textarea placeholder="Write something..." className="w-60" />
      </TestSection>

      <TestSection title="Toast">
        <ToastProvider>
          <Toast>Default toast</Toast>
          <ToastViewport />
        </ToastProvider>
      </TestSection>

      <TestSection title="Toaster">
        <Toaster />
      </TestSection>

      <TestSection title="Tooltip">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline">Hover me</Button>
            </TooltipTrigger>
            <TooltipContent>Tooltip content</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TestSection>
    </div>
  )
}
