"use client";

import type { PropsWithChildren } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App, ConfigProvider } from "antd";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AntdRegistry>
      <ConfigProvider
        theme={{
          token: {
            colorPrimary: "#1768ac",
            colorInfo: "#1768ac",
            colorSuccess: "#1f8f5f",
            colorWarning: "#ffb703",
            colorError: "#c2410c",
            borderRadius: 14
          }
        }}
      >
        <App>{children}</App>
      </ConfigProvider>
    </AntdRegistry>
  );
}
