import { GAME_ROLES, ROLES_INTRO, ROLE_TEAM_CLASS } from '../content/rolesContent';

interface RolesProps {
  embedded?: boolean;
}

export default function Roles({ embedded = false }: RolesProps) {
  return (
    <div className={embedded ? 'roles-embedded' : 'roles-page'}>
      <article className="roles-article" itemScope itemType="https://schema.org/Article">
        {!embedded && (
          <header className="page-header">
            <h1 itemProp="headline">Игровые роли</h1>
            <p className="roles-intro muted" itemProp="description">
              {ROLES_INTRO}
            </p>
          </header>
        )}

        <div className="roles-grid" role="list">
          {GAME_ROLES.map((role, index) => (
            <section
              key={role.id}
              className="role-card"
              role="listitem"
              itemScope
              itemType="https://schema.org/ListItem"
              itemProp="itemListElement"
            >
              <meta itemProp="position" content={String(index + 1)} />
              <div className="role-card-head">
                <span className="role-card-icon" aria-hidden="true">
                  {role.icon}
                </span>
                <div className="role-card-titles">
                  <h2 className="role-card-name" itemProp="name">
                    {role.name}
                  </h2>
                  <span className={`role-card-team ${ROLE_TEAM_CLASS[role.team]}`}>
                    {role.teamLabel}
                  </span>
                </div>
              </div>
              <p className="role-card-text" itemProp="description">
                {role.description}
              </p>
              <p className="role-card-availability muted">{role.availability}</p>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
