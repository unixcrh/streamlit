/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React, { ComponentType, ReactElement, useEffect, useState } from "react"
import { ExpandMore, ExpandLess } from "@emotion-icons/material-outlined"
import Icon from "@streamlit/lib/src/components/shared/Icon"
import StreamlitMarkdown from "@streamlit/lib/src/components/shared/StreamlitMarkdown"

import classNames from "classnames"
import {
  StatelessAccordion as Accordion,
  Panel,
  SharedStylePropsArg,
} from "baseui/accordion"
import { useTheme } from "@emotion/react"
import { StyledExpandableContainer } from "./styled-components"

export interface ExpandableProps {
  expandable: boolean
  label: string
  expanded: boolean
  empty: boolean
  widgetsDisabled: boolean
  isStale: boolean
}

// Our wrapper takes the wrapped component's props plus ExpandableProps
type WrapperProps<P> = P & ExpandableProps

// TODO: there's no reason for this to be a HOC. Adapt it to follow the same
//  pattern as the `Tabs` and `ChatMessage` containers that simply parent their
//  children.
function withExpandable<P>(
  WrappedComponent: ComponentType<P>
): ComponentType<WrapperProps<P>> {
  const ExpandableComponent = (props: WrapperProps<P>): ReactElement => {
    const {
      label,
      expanded: initialExpanded,
      empty,
      widgetsDisabled,
      isStale,
      ...componentProps
    } = props

    const [expanded, setExpanded] = useState<boolean>(initialExpanded)
    useEffect(() => {
      setExpanded(initialExpanded)
      // Having `label` in the dependency array here is necessary because
      // sometimes two distinct expanders look so similar that even the react
      // diffing algorithm decides that they're the same element with updated
      // props (this happens when something in the app removes one expander and
      // replaces it with another in the same position).
      //
      // By adding `label` as a dependency, we ensure that we reset the
      // expander's `expanded` state in this edge case.
    }, [label, initialExpanded])

    const toggle = (): void => setExpanded(!expanded)
    const { colors, radii, spacing, fontSizes } = useTheme()

    return (
      <StyledExpandableContainer data-testid="stExpander">
        <Accordion
          onChange={toggle}
          expanded={expanded ? ["panel"] : []}
          disabled={widgetsDisabled}
          overrides={{
            Content: {
              style: ({ $expanded }: SharedStylePropsArg) => ({
                backgroundColor: colors.transparent,
                marginLeft: spacing.none,
                marginRight: spacing.none,
                marginTop: spacing.none,
                marginBottom: spacing.none,
                overflow: "visible",
                paddingLeft: spacing.lg,
                paddingRight: spacing.lg,
                paddingTop: 0,
                paddingBottom: $expanded ? spacing.lg : 0,
                borderTopStyle: "none",
                borderBottomStyle: "none",
                borderRightStyle: "none",
                borderLeftStyle: "none",
              }),
              props: { className: "streamlit-expanderContent" },
            },
            // Allow fullscreen button to overflow the expander
            ContentAnimationContainer: {
              style: ({ $expanded }: SharedStylePropsArg) => ({
                overflow: $expanded ? "visible" : "hidden",
              }),
            },
            PanelContainer: {
              style: () => ({
                marginLeft: `${spacing.none} !important`,
                marginRight: `${spacing.none} !important`,
                marginTop: `${spacing.none} !important`,
                marginBottom: `${spacing.none} !important`,
                paddingLeft: `${spacing.none} !important`,
                paddingRight: `${spacing.none} !important`,
                paddingTop: `${spacing.none} !important`,
                paddingBottom: `${spacing.none} !important`,
                borderTopStyle: "none !important",
                borderBottomStyle: "none !important",
                borderRightStyle: "none !important",
                borderLeftStyle: "none !important",
              }),
            },
            Header: {
              style: ({ $disabled }: SharedStylePropsArg) => ({
                marginBottom: spacing.none,
                marginLeft: spacing.none,
                marginRight: spacing.none,
                marginTop: spacing.none,
                backgroundColor: colors.transparent,
                color: $disabled ? colors.disabled : colors.bodyText,
                fontSize: fontSizes.sm,
                borderTopStyle: "none",
                borderBottomStyle: "none",
                borderRightStyle: "none",
                borderLeftStyle: "none",
                paddingBottom: spacing.md,
                paddingTop: spacing.md,
                paddingRight: spacing.lg,
                paddingLeft: spacing.lg,
                ...(isStale
                  ? {
                      opacity: 0.33,
                      transition: "opacity 1s ease-in 0.5s",
                    }
                  : {}),
              }),
              props: {
                className: "streamlit-expanderHeader",
                isStale,
              },
            },
            ToggleIcon: {
              style: ({ $disabled }: SharedStylePropsArg) => ({
                color: $disabled ? colors.disabled : colors.bodyText,
              }),
              // eslint-disable-next-line react/display-name
              component: () => {
                if (expanded) {
                  return <Icon content={ExpandLess} size="lg" />
                }
                return <Icon content={ExpandMore} size="lg" />
              },
            },
            Root: {
              props: {
                className: classNames("streamlit-expander", { empty }),
                isStale,
              },
              style: {
                borderStyle: "solid",
                borderWidth: "1px",
                borderColor: colors.fadedText10,
                borderRadius: radii.lg,
                ...(isStale
                  ? {
                      borderColor: colors.fadedText05,
                      transition: "border 1s ease-in 0.5s",
                    }
                  : {}),
              },
            },
          }}
        >
          <Panel
            title={
              <StreamlitMarkdown source={label} allowHTML={false} isLabel />
            }
            key="panel"
          >
            <WrappedComponent
              // (this.props as unknown as P) is required to work around a TS issue:
              // https://github.com/microsoft/TypeScript/issues/28938#issuecomment-450636046
              {...(componentProps as unknown as P)}
              disabled={widgetsDisabled}
            />
          </Panel>
        </Accordion>
      </StyledExpandableContainer>
    )
  }

  return ExpandableComponent
}

export default withExpandable
