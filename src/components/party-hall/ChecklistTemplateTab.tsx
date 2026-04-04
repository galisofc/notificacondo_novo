import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, ClipboardList, GripVertical } from "lucide-react";

interface ChecklistTemplate {
  id: string;
  condominium_id: string;
  item_name: string;
  category: string;
  is_active: boolean;
  display_order: number;
}

const DEFAULT_CATEGORIES = ["Geral", "Elétrica", "Móveis", "Limpeza", "Utensílios", "Decoração", "Segurança", "Estrutura", "Equipamentos", "Hidráulica"];

function SortableItem({
  item,
  onToggle,
  onDelete,
}: {
  item: ChecklistTemplate;
  onToggle: (id: string, is_active: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none">
        <GripVertical className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
      </button>
      <span className={`flex-1 text-sm ${!item.is_active ? "text-muted-foreground line-through" : "text-foreground"}`}>
        {item.item_name}
      </span>
      <div className="flex items-center gap-2">
        <Switch checked={item.is_active} onCheckedChange={(checked) => onToggle(item.id, checked)} />
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(item.id)}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function ChecklistTemplateTab({ condominiumId }: { condominiumId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState({ item_name: "", category: "Geral" });
  const [customCategory, setCustomCategory] = useState("");
  const [useCustomCategory, setUseCustomCategory] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["checklist-templates", condominiumId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("party_hall_checklist_templates")
        .select("*")
        .eq("condominium_id", condominiumId)
        .order("display_order");
      if (error) throw error;
      return data as ChecklistTemplate[];
    },
    enabled: !!condominiumId,
  });

  // Merge default + existing custom categories
  const existingCategories = [...new Set(templates.map((t) => t.category || "Geral"))];
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...existingCategories])].sort();

  const createMutation = useMutation({
    mutationFn: async () => {
      const category = useCustomCategory ? customCategory.trim() : newItem.category;
      if (!category) throw new Error("Categoria obrigatória");
      const { error } = await supabase.from("party_hall_checklist_templates").insert({
        condominium_id: condominiumId,
        item_name: newItem.item_name,
        category,
        display_order: templates.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      setDialogOpen(false);
      setNewItem({ item_name: "", category: "Geral" });
      setCustomCategory("");
      setUseCustomCategory(false);
      toast({ title: "Item adicionado!" });
    },
    onError: () => toast({ title: "Erro ao adicionar item", variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("party_hall_checklist_templates")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["checklist-templates"] }),
    onError: () => toast({ title: "Erro ao atualizar item", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("party_hall_checklist_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checklist-templates"] });
      toast({ title: "Item excluído!" });
    },
    onError: () => toast({ title: "Erro ao excluir item", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: async (reorderedItems: { id: string; display_order: number }[]) => {
      const updates = reorderedItems.map(({ id, display_order }) =>
        supabase.from("party_hall_checklist_templates").update({ display_order }).eq("id", id)
      );
      const results = await Promise.all(updates);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["checklist-templates"] }),
    onError: () => toast({ title: "Erro ao reordenar", variant: "destructive" }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = templates.findIndex((t) => t.id === active.id);
    const newIndex = templates.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(templates, oldIndex, newIndex);

    // Optimistic update
    queryClient.setQueryData(["checklist-templates", condominiumId], reordered);

    reorderMutation.mutate(
      reordered.map((item, index) => ({ id: item.id, display_order: index }))
    );
  };

  // Group by category preserving order
  const grouped = templates.reduce<Record<string, ChecklistTemplate[]>>((acc, item) => {
    const cat = item.category || "Geral";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Item de Checklist</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Nome do Item</Label>
                <Input
                  value={newItem.item_name}
                  onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                  placeholder="Ex: Ar Condicionado"
                />
              </div>
              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select value={newItem.category} onValueChange={(v) => setNewItem({ ...newItem, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate()} disabled={!newItem.item_name || createMutation.isPending}>
                Adicionar Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum item de checklist cadastrado. Clique em 'Novo Item' para começar.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, categoryItems]) => (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  {category}
                  <Badge variant="secondary">{categoryItems.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={categoryItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {categoryItems.map((item) => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        onToggle={(id, checked) => toggleMutation.mutate({ id, is_active: checked })}
                        onDelete={(id) => deleteMutation.mutate(id)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
