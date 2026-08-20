'use client';

import React from 'react';
import { Group, Expense, GroupMember } from '@/types/database';
import { Modal } from '@/components/ui/Modal';
import { ExpenseChartsView } from './ExpenseChartsView';

export interface ExpenseChartsModalProps {
  group: Group;
  expenses: Expense[];
  members: GroupMember[];
  isOpen: boolean;
  onClose: () => void;
}

export const ExpenseChartsModal: React.FC<ExpenseChartsModalProps> = ({
  group,
  expenses,
  members,
  isOpen,
  onClose,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gráficas y Estadísticas de Gastos"
      description={`Análisis temporal y desglose por personas para ${group.name}`}
      maxWidth="xl"
    >
      <ExpenseChartsView
        group={group}
        expenses={expenses}
        members={members}
        onClose={onClose}
      />
    </Modal>
  );
};
