from partners.models import ProgramActivity


def log_activity(
    event_type: str,
    *,
    description: str = "",
    partner=None,
    user=None,
    sale=None,
    click=None,
    payment=None,
    ip_address: str = "",
    user_agent: str = "",
    metadata: dict | None = None,
) -> ProgramActivity:
    return ProgramActivity.objects.create(
        event_type=event_type,
        description=description,
        partner=partner,
        user=user,
        sale=sale,
        click=click,
        payment=payment,
        ip_address=ip_address or None,
        user_agent=user_agent,
        metadata=metadata or {},
    )
