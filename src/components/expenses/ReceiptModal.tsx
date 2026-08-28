'use client';

import React from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl: string | null;
  title: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptUrl,
  title,
}) => {
  const { t } = useTranslation();
  if (!receiptUrl) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('expenses.receiptPhoto')}: ${title}`}
      description={t('expenses.receiptPhoto')}
      maxWidth="lg"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-full max-h-[60vh] overflow-auto rounded-xl bg-slate-950 flex items-center justify-center p-2">
          <img
            src={receiptUrl}
            alt={title}
            className="max-h-[55vh] object-contain rounded-lg shadow-md"
          />
        </div>

        <div className="flex justify-end w-full gap-2">
          <a
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex"
          >
            <Button variant="secondary" size="sm">
              <ExternalLink className="w-4 h-4" />
              {t('expenses.viewReceipt')}
            </Button>
          </a>
          <Button variant="brand" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
