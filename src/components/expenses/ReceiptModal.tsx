'use client';

import React from 'react';
import { useTranslation } from '@/context/LanguageContext';
import { Modal } from '@/components/ui/Modal';
import { ExternalLink, Download } from 'lucide-react';
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

  const handleOpenNewTab = () => {
    if (!receiptUrl) return;

    if (receiptUrl.startsWith('data:')) {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`
          <!DOCTYPE html>
          <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${title || 'Comprobante de Gasto'} - Pachas</title>
              <style>
                body {
                  margin: 0;
                  background-color: #090d16;
                  color: #f8fafc;
                  font-family: system-ui, -apple-system, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  padding: 16px;
                  box-sizing: border-box;
                }
                .bar {
                  margin-bottom: 16px;
                  font-size: 15px;
                  font-weight: 700;
                  color: #34d399;
                  text-align: center;
                  letter-spacing: 0.02em;
                }
                .container {
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  background: #020617;
                  padding: 12px;
                  border-radius: 16px;
                  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                  max-width: 95vw;
                  max-height: 88vh;
                }
                img {
                  max-width: 100%;
                  max-height: 85vh;
                  object-fit: contain;
                  border-radius: 10px;
                }
              </style>
            </head>
            <body>
              <div class="bar">🧾 ${title || 'Ticket / Comprobante'}</div>
              <div class="container">
                <img src="${receiptUrl}" alt="${title || 'Ticket'}" />
              </div>
            </body>
          </html>
        `);
        win.document.close();
        return;
      }
    }

    window.open(receiptUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownload = () => {
    if (!receiptUrl) return;
    const a = document.createElement('a');
    a.href = receiptUrl;
    const safeTitle = (title || 'ticket').toLowerCase().replace(/[^a-z0-9]/g, '_');
    a.download = `pachas_ticket_${safeTitle}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t('expenses.receiptPhoto')}: ${title}`}
      description={t('expenses.receiptPhoto')}
      maxWidth="lg"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-full max-h-[62vh] overflow-auto rounded-2xl bg-slate-950/90 border border-slate-800 flex items-center justify-center p-3 shadow-inner">
          <img
            src={receiptUrl}
            alt={title}
            className="max-h-[58vh] object-contain rounded-xl shadow-xl transition-transform hover:scale-[1.01]"
          />
        </div>

        <div className="flex items-center justify-between w-full gap-2 pt-1">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="text-xs font-bold gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('expenses.downloadReceipt')}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleOpenNewTab}
              className="text-xs font-bold gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t('expenses.viewReceipt')}</span>
            </Button>
          </div>

          <Button variant="brand" size="sm" onClick={onClose} className="text-xs font-bold px-4">
            {t('common.close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
