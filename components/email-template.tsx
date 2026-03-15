import * as React from 'react';

interface UploadNotificationEmailProps {
  firstName: string;
  fileName: string;
  adminPanelUrl: string;
}

export const UploadNotificationEmail: React.FC<
  UploadNotificationEmailProps
> = ({ firstName, fileName, adminPanelUrl }) => {
  return (
    <div
      style={{
        backgroundColor: '#fff',
        padding: '24px',
        fontFamily: 'Arial, sans-serif',
        color: '#111827',
      }}
    >
      {/* Outer container */}
      <div
        style={{
          maxWidth: '600px',
          margin: '0 auto',
          backgroundColor: '#14181f',
          //   borderRadius: '8px',
          overflow: 'hidden',
          borderColor: '#29303d',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Header */}
        <div
          style={{
            backgroundColor: '#3B82F6',
            color: '#FFFFFF',
            padding: '16px',
            textAlign: 'center',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '20px', lineHeight: '24px' }}>
            New Credit Report Uploaded
          </h1>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', lineHeight: '1.5' }}>
          <p style={{ margin: '0 0 16px 0', color: '#FFFFFF80' }}>Hi Admin,</p>
          <p style={{ margin: '0 0 16px 0', color: '#FFFFFF80' }}>
            <strong>{firstName}</strong> has just uploaded a new credit report:
          </p>
          <p
            style={{
              margin: '0 0 24px 0',
              fontStyle: 'italic',
              color: '#FFFFFF80',
            }}
          >
            {fileName}
          </p>

          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <a
              href={adminPanelUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                backgroundColor: '#3B82F6',
                color: '#FFFFFF',
                textDecoration: 'none',
                padding: '12px 24px',
                borderRadius: '4px',
                fontSize: '16px',
              }}
            >
              View in Admin Panel
            </a>
          </div>

          <p style={{ margin: '0 0 8px 0', color: '#FFFFFF80' }}>Thanks</p>
        </div>

        {/* Footer */}
        <div
          style={{
            backgroundColor: '#14181f',
            padding: '12px 24px',
            fontSize: '12px',
            color: '#6B7280',
            textAlign: 'center',
            // borderTop: 1,
            borderWidth: 3,
            borderColor: '#29303d',
          }}
        >
          &copy; {new Date().getFullYear()} Vestblock. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default UploadNotificationEmail;
